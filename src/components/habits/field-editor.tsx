import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { GlassCard } from '@/components/common/glass-card'
import { TEXT_MAX_LENGTH_DEFAULT, TEXT_MAX_LENGTH_LIMIT } from '@/domain/field-schema'
import { cn } from '@/lib/utils'
import type { FieldType } from '@/types/models'
import {
  errorKey, FIELD_TYPE_LABELS, FIELD_TYPES, isChoiceType, LABEL_MAX, MAX_OPTIONS, OPTION_MAX, UNIT_MAX,
  type BuilderErrors, type BuilderField,
} from './builder-model'

type Props = {
  field: BuilderField
  index: number
  count: number
  errors: BuilderErrors
  onChange: (patch: Partial<BuilderField>) => void
  onTypeChange: (type: FieldType) => void
  onRemove: () => void
  onMove: (direction: -1 | 1) => void
}

function ErrorText({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  ) : null
}

/** Editor card for one habit field: label, type, unit, options, required flag and validation. */
export function FieldEditor({ field, index, count, errors, onChange, onTypeChange, onRemove, onMove }: Props) {
  const id = `field-${field.uid}`
  const err = (part: Parameters<typeof errorKey.field>[1]) => errors[errorKey.field(field.uid, part)]
  const title = field.label.trim() || `Field ${index + 1}`

  return (
    <GlassCard as="li" className="space-y-4" aria-label={`Field ${index + 1}: ${title}`}>
      <div className="flex items-center gap-1">
        <p className="min-w-0 flex-1 truncate text-sm font-bold">
          <span className="text-muted-foreground">{index + 1}.</span> {title}
        </p>
        <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Move ${title} up`} disabled={index === 0} onClick={() => onMove(-1)}>
          <ArrowUp className="size-5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label={`Move ${title} down`}
          disabled={index === count - 1}
          onClick={() => onMove(1)}
        >
          <ArrowDown className="size-5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 text-destructive"
          aria-label={`Remove ${title}`}
          disabled={count <= 1}
          onClick={onRemove}
        >
          <Trash2 className="size-5" />
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${id}-label`}>Label</Label>
        <Input
          id={`${id}-label`}
          className="h-12 text-base"
          placeholder="e.g. Hours read"
          maxLength={LABEL_MAX}
          value={field.label}
          aria-invalid={!!err('label')}
          aria-describedby={err('label') ? `${id}-label-error` : undefined}
          onChange={(e) => onChange({ label: e.target.value })}
        />
        <ErrorText id={`${id}-label-error`} message={err('label')} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={cn('space-y-2', field.field_type !== 'number' && 'col-span-2')}>
          <Label htmlFor={`${id}-type`}>Type</Label>
          <Select value={field.field_type} onValueChange={(v) => onTypeChange(v as FieldType)}>
            <SelectTrigger id={`${id}-type`} className="h-12 w-full text-base data-[size=default]:h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="min-h-11">
                  {FIELD_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {field.field_type === 'number' ? (
          <div className="space-y-2">
            <Label htmlFor={`${id}-unit`}>
              Unit <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id={`${id}-unit`}
              className="h-12 text-base"
              placeholder="e.g. h, km"
              maxLength={UNIT_MAX}
              value={field.unit}
              aria-invalid={!!err('unit')}
              onChange={(e) => onChange({ unit: e.target.value })}
            />
            <ErrorText id={`${id}-unit-error`} message={err('unit')} />
          </div>
        ) : null}
      </div>

      {field.field_type === 'number' ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <NumberSetting id={`${id}-min`} label="Minimum" value={field.min} error={err('min')} onChange={(min) => onChange({ min })} />
            <NumberSetting id={`${id}-max`} label="Maximum" value={field.max} error={err('max')} onChange={(max) => onChange({ max })} />
          </div>
          <SwitchRow
            id={`${id}-integer`}
            label="Whole numbers only"
            hint="Turn off to allow decimals like 7.5"
            checked={field.integer}
            onCheckedChange={(integer) => onChange({ integer })}
          />
        </div>
      ) : null}

      {field.field_type === 'text' ? (
        <div className="space-y-2">
          <Label htmlFor={`${id}-maxlength`}>
            Maximum length <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id={`${id}-maxlength`}
            className="h-12 text-base"
            inputMode="numeric"
            placeholder={String(TEXT_MAX_LENGTH_DEFAULT)}
            value={field.maxLength}
            aria-invalid={!!err('maxLength')}
            aria-describedby={`${id}-maxlength-help`}
            onChange={(e) => onChange({ maxLength: e.target.value })}
          />
          <p id={`${id}-maxlength-help`} className="text-xs text-muted-foreground">
            Up to {TEXT_MAX_LENGTH_LIMIT} characters. Leave empty for {TEXT_MAX_LENGTH_DEFAULT}.
          </p>
          <ErrorText id={`${id}-maxlength-error`} message={err('maxLength')} />
        </div>
      ) : null}

      {isChoiceType(field.field_type) ? (
        <OptionsEditor field={field} errors={errors} onChange={(options) => onChange({ options })} />
      ) : null}

      <SwitchRow
        id={`${id}-required`}
        label="Required"
        hint={field.required ? 'Must be filled in to save an entry' : 'Can be left empty'}
        checked={field.required}
        onCheckedChange={(required) => onChange({ required })}
      />
    </GlassCard>
  )
}

function NumberSetting({ id, label, value, error, onChange }: { id: string; label: string; value: string; error?: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} <span className="font-normal text-muted-foreground">(optional)</span>
      </Label>
      <Input
        id={id}
        className="h-12 text-base"
        inputMode="decimal"
        value={value}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      <ErrorText id={`${id}-error`} message={error} />
    </div>
  )
}

export function SwitchRow({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string
  label: string
  hint?: React.ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex min-h-11 items-center gap-3">
      <div className="min-w-0 flex-1">
        <Label htmlFor={id} className="text-sm font-semibold">
          {label}
        </Label>
        {hint ? (
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="scale-125"
      />
    </div>
  )
}

function OptionsEditor({ field, errors, onChange }: { field: BuilderField; errors: BuilderErrors; onChange: (options: string[]) => void }) {
  const listError = errors[errorKey.field(field.uid, 'options')]
  const update = (i: number, value: string) => onChange(field.options.map((o, j) => (j === i ? value : o)))
  const remove = (i: number) => onChange(field.options.filter((_, j) => j !== i))

  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">Options</legend>
      <ul className="space-y-2">
        {field.options.map((option, i) => {
          const id = `field-${field.uid}-option-${i}`
          const error = errors[errorKey.option(field.uid, i)]
          return (
            <li key={i} className="space-y-1">
              <div className="flex items-center gap-2">
                <Label htmlFor={id} className="sr-only">
                  Option {i + 1}
                </Label>
                <Input
                  id={id}
                  className="h-11 text-base"
                  placeholder={`Option ${i + 1}`}
                  maxLength={OPTION_MAX}
                  value={option}
                  aria-invalid={!!error}
                  aria-describedby={error ? `${id}-error` : undefined}
                  onChange={(e) => update(i, e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 shrink-0"
                  aria-label={`Remove option ${i + 1}`}
                  disabled={field.options.length <= 2}
                  onClick={() => remove(i)}
                >
                  <X className="size-5" />
                </Button>
              </div>
              <ErrorText id={`${id}-error`} message={error} />
            </li>
          )
        })}
      </ul>
      <Button
        type="button"
        variant="secondary"
        className="h-11 w-full"
        disabled={field.options.length >= MAX_OPTIONS}
        onClick={() => onChange([...field.options, ''])}
      >
        <Plus className="size-4" /> Add option
      </Button>
      <p className="text-xs text-muted-foreground">2 to {MAX_OPTIONS} options, each one different.</p>
      <ErrorText id={`field-${field.uid}-options-error`} message={listError} />
    </fieldset>
  )
}
