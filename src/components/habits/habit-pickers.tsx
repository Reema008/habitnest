import { Check } from 'lucide-react'
import { HABIT_ICONS, habitColor, SELECTABLE_HABIT_ICONS } from '@/components/common/habit-visuals'
import { WEEKDAY_LONG, WEEKDAY_SHORT } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { HABIT_COLORS, type HabitColor } from '@/types/models'

const ICON_LABELS: Record<string, string> = {
  'glass-water': 'glass of water',
  'book-open': 'open book',
}

/** Grid of habit icons (single choice). */
export function IconPicker({ value, color, onChange }: { value: string; color: HabitColor; onChange: (icon: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Icon" className="grid grid-cols-6 gap-2">
      {SELECTABLE_HABIT_ICONS.map((key) => {
        const Icon = HABIT_ICONS[key]!
        const selected = value === key
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={ICON_LABELS[key] ?? key.replace(/-/g, ' ')}
            onClick={() => onChange(key)}
            className={cn(
              'flex aspect-square min-h-11 items-center justify-center rounded-xl transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              selected ? cn(habitColor(color).bg, 'ring-2 ring-primary') : 'bg-glass hover:bg-lavender/30',
            )}
          >
            <Icon className="size-5 text-foreground/80" aria-hidden />
          </button>
        )
      })}
    </div>
  )
}

/** Row of pastel colour swatches (single choice). */
export function ColorPicker({ value, onChange }: { value: HabitColor; onChange: (color: HabitColor) => void }) {
  return (
    <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-3">
      {HABIT_COLORS.map((c) => {
        const selected = value === c
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={c}
            onClick={() => onChange(c)}
            className={cn(
              'flex size-11 items-center justify-center rounded-full border border-glass-border transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              habitColor(c).bg,
              selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
            )}
          >
            {selected ? <Check className="size-5 text-foreground/80" aria-hidden /> : null}
          </button>
        )
      })}
    </div>
  )
}

// Monday-first display order; values stay 0 = Sunday … 6 = Saturday.
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const PRESETS: { label: string; days: number[] }[] = [
  { label: 'Every day', days: [0, 1, 2, 3, 4, 5, 6] },
  { label: 'Weekdays', days: [1, 2, 3, 4, 5] },
  { label: 'Weekends', days: [0, 6] },
]

/** Pick which weekdays a habit is scheduled on (at least one). */
export function WeekdayPicker({
  value,
  onChange,
  invalid,
  describedBy,
}: {
  value: number[]
  onChange: (days: number[]) => void
  invalid?: boolean
  describedBy?: string
}) {
  const set = new Set(value)
  const toggle = (d: number) => {
    const next = new Set(set)
    if (next.has(d)) next.delete(d)
    else next.add(d)
    onChange([...next].sort((a, b) => a - b))
  }
  const isPreset = (days: number[]) => days.length === set.size && days.every((d) => set.has(d))

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Days of the week" aria-describedby={describedBy} className="grid grid-cols-7 gap-1.5">
        {DISPLAY_ORDER.map((d) => {
          const on = set.has(d)
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              aria-label={WEEKDAY_LONG[d]}
              aria-invalid={invalid || undefined}
              onClick={() => toggle(d)}
              className={cn(
                'flex h-11 items-center justify-center rounded-xl text-sm font-semibold transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                on ? 'bg-primary text-primary-foreground' : 'bg-glass text-muted-foreground hover:bg-lavender/30',
                invalid && !on && 'ring-1 ring-destructive/50',
              )}
            >
              {WEEKDAY_SHORT[d]!.slice(0, 2)}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            aria-pressed={isPreset(p.days)}
            onClick={() => onChange([...p.days])}
            className={cn(
              'h-11 rounded-full border px-4 text-sm font-medium transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              isPreset(p.days) ? 'border-primary bg-lavender/50' : 'border-border bg-glass hover:bg-lavender/30',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}
