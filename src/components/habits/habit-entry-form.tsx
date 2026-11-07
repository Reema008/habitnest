import { useId, useMemo } from 'react'
import { Controller, useForm, useWatch, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CircleCheck, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { describeGoal, isEntryComplete, type GoalLike } from '@/domain/completion'
import {
  buildEntrySchema, formatFieldValue, NOTES_MAX_LENGTH, parseValidation, textMaxLength, toFormValues,
  type EntryFormInput, type EntrySubmission, type FieldSpec,
} from '@/domain/field-schema'
import { toUserMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import type { FieldValues } from '@/types/models'

export type HabitEntryFormProps = {
  /** Field definitions of the version being recorded (FieldDefinition[] or FieldDraft[]). */
  fields: readonly FieldSpec[]
  notesEnabled: boolean
  /** Built-in habit template (e.g. 'junk_food') for tailored copy. */
  templateKey?: string | null
  defaultValues?: FieldValues
  defaultNotes?: string | null
  /** Receives clean values (numbers as numbers, empty optional fields omitted). Throw to show an error. */
  onSubmit: (values: FieldValues, notes: string | null) => void | Promise<void>
  submitLabel?: string
  submittingLabel?: string
  disabled?: boolean
  /** When given, shows live feedback on whether the goal would be reached. */
  goal?: GoalLike | null
  /** Extra actions rendered under the submit button (e.g. delete). */
  footer?: React.ReactNode
  className?: string
}

/**
 * Renders inputs for a habit version's fields and validates them with the same rules as the server.
 * Re-mounts automatically when the field definitions change.
 */
export function HabitEntryForm(props: HabitEntryFormProps) {
  const signature = useMemo(
    () =>
      JSON.stringify([
        props.notesEnabled,
        props.fields.map((f) => [f.field_key, f.label, f.field_type, f.unit ?? null, f.options, f.required, f.validation]),
      ]),
    [props.fields, props.notesEnabled],
  )
  return <EntryForm key={signature} {...props} />
}

function EntryForm({
  fields,
  notesEnabled,
  templateKey,
  defaultValues,
  defaultNotes,
  onSubmit,
  submitLabel = 'Save',
  submittingLabel = 'Saving…',
  disabled = false,
  goal,
  footer,
  className,
}: HabitEntryFormProps) {
  const idPrefix = useId()
  const schema = useMemo(() => buildEntrySchema(fields, notesEnabled), [fields, notesEnabled])
  const form = useForm<EntryFormInput, unknown, EntrySubmission>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { values: toFormValues(fields, defaultValues), notes: defaultNotes ?? '' },
  })
  const { errors, isSubmitting } = form.formState

  const submit = form.handleSubmit(async (data) => {
    try {
      await onSubmit(data.values, data.notes)
    } catch (e) {
      form.setError('root.server', { message: toUserMessage(e) })
    }
  })

  const rootMessage = errors.root?.message ?? errors.root?.server?.message
  const notesValue = useWatch({ control: form.control, name: 'notes' }) ?? ''

  return (
    <form onSubmit={submit} noValidate className={cn('space-y-5', className)}>
      {goal ? <GoalHint control={form.control} fields={fields} goal={goal} /> : null}

      <fieldset disabled={disabled || isSubmitting} className="space-y-5">
        <legend className="sr-only">Entry values</legend>
        {fields.map((field) => (
          <FieldInput
            key={field.field_key}
            field={field}
            id={`${idPrefix}-${field.field_key}`}
            control={form.control}
            register={form.register}
            errors={errors}
          />
        ))}

        {notesEnabled ? (
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-notes`}>
              Additional notes <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id={`${idPrefix}-notes`}
              rows={3}
              className="min-h-24 text-base"
              placeholder={templateKey === 'junk_food' ? 'What did you eat? (optional)' : 'Anything you want to remember? (optional)'}
              aria-invalid={!!errors.notes}
              aria-describedby={`${idPrefix}-notes-help`}
              {...form.register('notes')}
            />
            <div id={`${idPrefix}-notes-help`} className="flex justify-between gap-2 text-xs">
              <span className="text-destructive">{errors.notes?.message}</span>
              <span className={cn('text-muted-foreground', notesValue.length > NOTES_MAX_LENGTH && 'text-destructive')}>
                {notesValue.length}/{NOTES_MAX_LENGTH}
              </span>
            </div>
          </div>
        ) : null}
      </fieldset>

      {rootMessage ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {rootMessage}
        </p>
      ) : null}

      <div className="space-y-2">
        <Button type="submit" className="h-12 w-full text-base" disabled={disabled || isSubmitting}>
          {isSubmitting ? submittingLabel : submitLabel}
        </Button>
        {footer}
      </div>
    </form>
  )
}

function GoalHint({ control, fields, goal }: { control: Control<EntryFormInput>; fields: readonly FieldSpec[]; goal: GoalLike }) {
  const raw = useWatch({ control, name: 'values' })
  const description = describeGoal(goal, fields)
  if (!description) return null
  const values: FieldValues = {}
  for (const [k, v] of Object.entries(raw ?? {})) if (v !== null && v !== undefined) values[k] = v
  const met = isEntryComplete(goal, fields, values)
  return (
    <div
      aria-live="polite"
      className={cn(
        'flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors',
        met ? 'bg-mint/50 font-semibold' : 'bg-lavender/40 text-muted-foreground',
      )}
    >
      {met ? <CircleCheck className="size-4 shrink-0 text-success" aria-hidden /> : <Target className="size-4 shrink-0" aria-hidden />}
      <span>{met ? `Goal reached — ${description}` : `Goal: ${description}`}</span>
    </div>
  )
}

function FieldLabel({ field, htmlFor, id }: { field: FieldSpec; htmlFor?: string; id?: string }) {
  const content = (
    <>
      {field.label}
      {field.required ? (
        <>
          <span aria-hidden className="text-destructive">
            {' '}*
          </span>
          <span className="sr-only"> (required)</span>
        </>
      ) : (
        <span className="font-normal text-muted-foreground"> (optional)</span>
      )}
    </>
  )
  return htmlFor ? (
    <Label htmlFor={htmlFor} id={id}>
      {content}
    </Label>
  ) : (
    <span id={id} className="text-sm leading-none font-medium">
      {content}
    </span>
  )
}

function numberHint(field: FieldSpec): string | null {
  const v = parseValidation(field.validation)
  const parts: string[] = []
  if (v.min !== undefined && v.max !== undefined) parts.push(`Between ${formatFieldValue(field, v.min)} and ${formatFieldValue(field, v.max)}`)
  else if (v.min !== undefined) parts.push(`At least ${formatFieldValue(field, v.min)}`)
  else if (v.max !== undefined) parts.push(`Up to ${formatFieldValue(field, v.max)}`)
  if (v.integer) parts.push('whole numbers')
  else parts.push('decimals like 7.5 are fine')
  const text = parts.join(' · ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function FieldInput({
  field,
  id,
  control,
  register,
  errors,
}: {
  field: FieldSpec
  id: string
  control: Control<EntryFormInput>
  register: UseFormRegister<EntryFormInput>
  errors: FieldErrors<EntryFormInput>
}) {
  const name = `values.${field.field_key}` as const
  const error = errors.values?.[field.field_key]?.message
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const errorText = error ? (
    <p id={errorId} className="text-sm text-destructive">
      {error}
    </p>
  ) : null

  if (field.field_type === 'number') {
    const rules = parseValidation(field.validation)
    const unit = field.unit?.trim()
    const hint = numberHint(field)
    const numeric = rules.integer && (rules.min === undefined || rules.min >= 0)
    return (
      <div className="space-y-2">
        <FieldLabel field={field} htmlFor={id} />
        <div className="relative">
          <Input
            id={id}
            type="text"
            inputMode={numeric ? 'numeric' : 'decimal'}
            autoComplete="off"
            className={cn('h-12 text-base', unit && 'pr-16')}
            aria-invalid={!!error}
            aria-required={field.required}
            aria-describedby={cn(hint && hintId, error && errorId) || undefined}
            {...register(name)}
          />
          {unit ? (
            <span className="pointer-events-none absolute top-1/2 right-3 max-w-14 -translate-y-1/2 truncate text-sm text-muted-foreground">
              {unit}
            </span>
          ) : null}
        </div>
        {hint ? (
          <p id={hintId} className="text-xs text-muted-foreground">
            {hint}
          </p>
        ) : null}
        {errorText}
      </div>
    )
  }

  if (field.field_type === 'text') {
    const max = textMaxLength(field)
    const multiline = max > 120
    const common = {
      id,
      'aria-invalid': !!error,
      'aria-required': field.required,
      'aria-describedby': cn(hintId, error && errorId),
      ...register(name),
    }
    return (
      <div className="space-y-2">
        <FieldLabel field={field} htmlFor={id} />
        {multiline ? <Textarea rows={3} className="min-h-24 text-base" {...common} /> : <Input className="h-12 text-base" autoComplete="off" {...common} />}
        <p id={hintId} className="text-xs text-muted-foreground">
          Up to {max} characters
        </p>
        {errorText}
      </div>
    )
  }

  const labelId = `${id}-label`
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: f }) => {
        const value = f.value === null || f.value === undefined ? '' : String(f.value)
        const clear =
          !field.required && value ? (
            <Button type="button" variant="ghost" className="h-11 px-3 text-muted-foreground" onClick={() => f.onChange('')}>
              Clear choice
            </Button>
          ) : null

        if (field.field_type === 'radio') {
          return (
            <div className="space-y-2">
              <FieldLabel field={field} id={labelId} />
              <RadioGroup
                value={value}
                onValueChange={f.onChange}
                onBlur={f.onBlur}
                aria-labelledby={labelId}
                aria-required={field.required}
                aria-invalid={!!error}
                aria-describedby={error ? errorId : undefined}
                className="gap-2"
              >
                {field.options.map((option, i) => (
                  <Label
                    key={option}
                    htmlFor={`${id}-opt-${i}`}
                    className={cn(
                      'flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border bg-glass px-4 py-3 text-base font-medium transition',
                      'has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-lavender/50',
                    )}
                  >
                    <RadioGroupItem id={`${id}-opt-${i}`} value={option} className="size-5" />
                    <span className="min-w-0 break-words">{option}</span>
                  </Label>
                ))}
              </RadioGroup>
              {clear}
              {errorText}
            </div>
          )
        }

        return (
          <div className="space-y-2">
            <FieldLabel field={field} htmlFor={id} />
            <Select value={value} onValueChange={f.onChange}>
              <SelectTrigger
                id={id}
                ref={f.ref}
                onBlur={f.onBlur}
                className="h-12 w-full text-base data-[size=default]:h-12"
                aria-invalid={!!error}
                aria-required={field.required}
                aria-describedby={error ? errorId : undefined}
              >
                <SelectValue placeholder="Choose an option" />
              </SelectTrigger>
              <SelectContent>
                {field.options.map((option) => (
                  <SelectItem key={option} value={option} className="min-h-11">
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {clear}
            {errorText}
          </div>
        )
      }}
    />
  )
}
