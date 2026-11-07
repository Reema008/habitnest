import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CalendarCheck, Sigma } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { GlassCard } from '@/components/common/glass-card'
import { useOnline } from '@/components/common/offline-banner'
import { isISODate, shiftDate, todayISO } from '@/lib/dates'
import { cn } from '@/lib/utils'
import {
  CHALLENGE_PRESETS, MAX_CHALLENGE_SPAN_DAYS, challengeLengthDays, describeMetric, validateChallengeDraft, type ChallengeDraft,
} from '@/domain/challenge'
import type { FamilyChallenge } from '@/types/models'

const schema = z
  .object({
    title: z.string(),
    description: z.string(),
    aggregation: z.enum(['sum', 'days_met']),
    metricLabel: z.string(),
    unit: z.string(),
    target: z.number({ error: 'Enter a target greater than 0.' }),
    startDate: z.string(),
    endDate: z.string(),
  })
  .superRefine((draft, ctx) => {
    const errors = validateChallengeDraft(draft)
    for (const [path, message] of Object.entries(errors)) {
      if (message) ctx.addIssue({ code: 'custom', path: [path], message })
    }
  })

type FormValues = z.infer<typeof schema>

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null
  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  )
}

/** Create / edit a family challenge. In edit mode the challenge type, metric and unit are fixed. */
export function ChallengeForm({
  initial,
  submitLabel,
  submitting,
  onSubmit,
  onCancel,
}: {
  initial?: FamilyChallenge
  submitLabel: string
  submitting: boolean
  onSubmit: (draft: ChallengeDraft) => Promise<void>
  onCancel: () => void
}) {
  const online = useOnline()
  const editing = !!initial
  const today = todayISO()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial
      ? {
          title: initial.title,
          description: initial.description ?? '',
          aggregation: initial.aggregation,
          metricLabel: initial.metric_label,
          unit: initial.unit ?? '',
          target: Number(initial.target),
          startDate: initial.start_date,
          endDate: initial.end_date,
        }
      : {
          title: '',
          description: '',
          aggregation: 'sum',
          metricLabel: 'Walking',
          unit: 'steps',
          target: 50000,
          startDate: today,
          endDate: shiftDate(today, 6),
        },
  })
  const { errors } = form.formState
  const [aggregation, metricLabel, unit, startDate] = useWatch({
    control: form.control,
    name: ['aggregation', 'metricLabel', 'unit', 'startDate'],
  })

  function chooseType(next: FormValues['aggregation']) {
    form.setValue('aggregation', next, { shouldDirty: true })
    if (next === 'days_met' && aggregation !== 'days_met') {
      const endDate = form.getValues('endDate')
      const length = isISODate(startDate) && isISODate(endDate) && endDate >= startDate
        ? challengeLengthDays({ start_date: startDate, end_date: endDate })
        : 7
      form.setValue('target', length, { shouldDirty: true })
    }
    if (form.formState.isSubmitted) void form.trigger()
  }

  function choosePreset(preset: (typeof CHALLENGE_PRESETS)[number]) {
    form.setValue('metricLabel', preset.metricLabel, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
    form.setValue('unit', preset.unit, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
  }

  const submit = form.handleSubmit(async (values) => {
    await onSubmit({
      ...values,
      metricLabel: values.aggregation === 'days_met' ? 'Days completed' : values.metricLabel.trim(),
      unit: values.aggregation === 'days_met' ? '' : values.unit.trim(),
    })
  })

  return (
    <form className="space-y-4" onSubmit={(e) => void submit(e)} noValidate>
      <GlassCard className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="challenge-title">Challenge name</Label>
          <Input
            id="challenge-title"
            className="h-12"
            maxLength={80}
            placeholder="e.g. Family step-up week"
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? 'challenge-title-error' : undefined}
            {...form.register('title')}
          />
          <FieldError id="challenge-title-error" message={errors.title?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="challenge-description">Description (optional)</Label>
          <Textarea
            id="challenge-description"
            rows={3}
            maxLength={300}
            placeholder="What's it about? Keep it friendly!"
            aria-invalid={!!errors.description}
            aria-describedby={errors.description ? 'challenge-description-error' : undefined}
            {...form.register('description')}
          />
          <FieldError id="challenge-description-error" message={errors.description?.message} />
        </div>
      </GlassCard>

      <GlassCard className="space-y-4">
        {editing && initial ? (
          <div className="space-y-1">
            <p className="text-sm font-medium">What counts</p>
            <p className="text-sm text-muted-foreground">
              {describeMetric(initial)}. The challenge type can't change once it's created.
            </p>
          </div>
        ) : (
          <>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Challenge type</legend>
              <div className="grid grid-cols-2 gap-3">
                <TypeButton
                  active={aggregation === 'sum'}
                  onClick={() => chooseType('sum')}
                  icon={<Sigma className="size-5" aria-hidden />}
                  title="Total amount"
                  hint="Add up a number, like steps"
                />
                <TypeButton
                  active={aggregation === 'days_met'}
                  onClick={() => chooseType('days_met')}
                  icon={<CalendarCheck className="size-5" aria-hidden />}
                  title="Days completed"
                  hint="Count days a habit is done"
                />
              </div>
            </fieldset>

            {aggregation === 'sum' ? (
              <div className="space-y-3">
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Quick picks</legend>
                  <div className="flex flex-wrap gap-2">
                    {CHALLENGE_PRESETS.map((p) => {
                      const active = metricLabel === p.metricLabel && unit === p.unit
                      return (
                        <button
                          key={p.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => choosePreset(p)}
                          className={cn(
                            'min-h-11 rounded-full border px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-ring',
                            active ? 'border-primary bg-lavender/60' : 'border-border bg-glass hover:bg-lavender/30',
                          )}
                        >
                          {p.metricLabel} — {p.unit}
                        </button>
                      )
                    })}
                  </div>
                </fieldset>
                <div className="grid grid-cols-[1fr_7rem] gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="challenge-metric">What's being added up</Label>
                    <Input
                      id="challenge-metric"
                      className="h-12"
                      maxLength={40}
                      aria-invalid={!!errors.metricLabel}
                      aria-describedby={errors.metricLabel ? 'challenge-metric-error' : undefined}
                      {...form.register('metricLabel')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="challenge-unit">Unit</Label>
                    <Input
                      id="challenge-unit"
                      className="h-12"
                      maxLength={20}
                      aria-invalid={!!errors.unit}
                      aria-describedby={errors.unit ? 'challenge-unit-error' : 'challenge-unit-hint'}
                      {...form.register('unit')}
                    />
                  </div>
                </div>
                <FieldError id="challenge-metric-error" message={errors.metricLabel?.message} />
                <FieldError id="challenge-unit-error" message={errors.unit?.message} />
                <p id="challenge-unit-hint" className="text-xs text-muted-foreground">
                  Members join with a shared habit that has a number field in the same unit.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Everyone links one of their shared habits. Each day the habit is completed counts towards the target.
              </p>
            )}
          </>
        )}

        <div className="space-y-2">
          <Label htmlFor="challenge-target">
            Target per person {aggregation === 'days_met' ? '(days)' : unit.trim() ? `(${unit.trim()})` : ''}
          </Label>
          <Input
            id="challenge-target"
            type="number"
            inputMode="decimal"
            min={aggregation === 'days_met' ? 1 : 0}
            step={aggregation === 'days_met' ? 1 : 'any'}
            className="h-12"
            aria-invalid={!!errors.target}
            aria-describedby={errors.target ? 'challenge-target-error' : undefined}
            {...form.register('target', { valueAsNumber: true })}
          />
          <FieldError id="challenge-target-error" message={errors.target?.message} />
        </div>
      </GlassCard>

      <GlassCard className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="challenge-start">Starts</Label>
            <Input
              id="challenge-start"
              type="date"
              className="h-12"
              aria-invalid={!!errors.startDate}
              aria-describedby={errors.startDate ? 'challenge-start-error' : undefined}
              {...form.register('startDate')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="challenge-end">Ends</Label>
            <Input
              id="challenge-end"
              type="date"
              className="h-12"
              min={isISODate(startDate) ? startDate : undefined}
              max={isISODate(startDate) ? shiftDate(startDate, MAX_CHALLENGE_SPAN_DAYS) : undefined}
              aria-invalid={!!errors.endDate}
              aria-describedby={errors.endDate ? 'challenge-end-error' : undefined}
              {...form.register('endDate')}
            />
          </div>
        </div>
        <FieldError id="challenge-start-error" message={errors.startDate?.message} />
        <FieldError id="challenge-end-error" message={errors.endDate?.message} />
        <p className="text-xs text-muted-foreground">Challenges can last from one day up to a year.</p>
      </GlassCard>

      <div className="flex gap-3">
        <Button type="button" variant="secondary" className="h-12 flex-1" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" className="h-12 flex-1" disabled={!online || submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
      {!online ? <p className="text-center text-xs text-muted-foreground">You're offline — reconnect to save.</p> : null}
    </form>
  )
}

function TypeButton({
  active,
  onClick,
  icon,
  title,
  hint,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  hint: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex min-h-24 flex-col items-start gap-1 rounded-2xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-ring',
        active ? 'border-primary bg-lavender/50' : 'border-border bg-glass hover:bg-lavender/30',
      )}
    >
      {icon}
      <span className="text-sm font-bold">{title}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </button>
  )
}
