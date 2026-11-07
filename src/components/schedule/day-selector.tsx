import { WEEKDAY_LONG, WEEKDAY_SHORT } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { WEEK_DAYS_MON_FIRST } from '@/domain/schedule'

/** Mon–Sun chips to switch the visible day. Shows a dot for days with plans and marks today. */
export function DayChips({
  value,
  onChange,
  today,
  counts,
}: {
  value: number
  onChange: (day: number) => void
  today: number
  counts: Record<number, number>
}) {
  return (
    <div role="group" aria-label="Day of the week" className="grid grid-cols-7 gap-[3px]">
      {WEEK_DAYS_MON_FIRST.map((day) => {
        const selected = day === value
        const count = counts[day] ?? 0
        return (
          <button
            key={day}
            type="button"
            aria-pressed={selected}
            aria-label={`${WEEKDAY_LONG[day]}${day === today ? ', today' : ''}${count ? `, ${count} planned` : ''}`}
            onClick={() => onChange(day)}
            className={cn(
              'flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl text-sm font-bold outline-none transition-colors',
              'focus-visible:ring-3 focus-visible:ring-ring/60',
              selected ? 'bg-primary text-primary-foreground shadow-md' : 'glass hover:bg-lavender/40',
              !selected && day === today && 'ring-2 ring-primary/60',
            )}
          >
            <span aria-hidden>{WEEKDAY_SHORT[day]}</span>
            <span
              aria-hidden
              className={cn(
                'size-1.5 rounded-full',
                count ? (selected ? 'bg-primary-foreground' : 'bg-primary') : 'bg-transparent',
              )}
            />
          </button>
        )
      })}
    </div>
  )
}

/** Day toggles for forms: multi-select (add / copy) or single-select (edit). */
export function DayToggles({
  value,
  onChange,
  multiple,
  disabledDays = [],
  labelledBy,
  invalid,
}: {
  value: number[]
  onChange: (days: number[]) => void
  multiple: boolean
  disabledDays?: number[]
  labelledBy: string
  invalid?: boolean
}) {
  function toggle(day: number) {
    if (!multiple) return onChange([day])
    onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day].sort((a, b) => a - b))
  }
  return (
    <div
      role={multiple ? 'group' : 'radiogroup'}
      aria-labelledby={labelledBy}
      aria-invalid={invalid || undefined}
      className="grid grid-cols-7 gap-[3px]"
    >
      {WEEK_DAYS_MON_FIRST.map((day) => {
        const on = value.includes(day)
        const disabled = disabledDays.includes(day)
        return (
          <button
            key={day}
            type="button"
            role={multiple ? undefined : 'radio'}
            aria-pressed={multiple ? on : undefined}
            aria-checked={multiple ? undefined : on}
            aria-label={WEEKDAY_LONG[day]}
            disabled={disabled}
            onClick={() => toggle(day)}
            className={cn(
              'flex h-11 min-w-0 items-center justify-center rounded-xl border text-sm font-bold outline-none transition-colors',
              'focus-visible:ring-3 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-40',
              on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-glass hover:bg-lavender/40',
            )}
          >
            <span aria-hidden>{WEEKDAY_SHORT[day]}</span>
          </button>
        )
      })}
    </div>
  )
}
