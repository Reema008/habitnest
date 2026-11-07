import { useId } from 'react'
import { format, parseISO } from 'date-fns'
import { dayOfWeek, WEEKDAY_LONG, WEEKDAY_SHORT, type ISODate } from '@/lib/dates'
import { GlassCard } from '@/components/common/glass-card'
import { cn } from '@/lib/utils'

export type HeatmapDay = {
  date: ISODate
  /** Completion ratio 0–1, or null when nothing was scheduled that day. */
  value: number | null
  /** Accessible description, e.g. "2 of 3 habits done". Defaults to a percentage. */
  description?: string
  isFuture?: boolean
}

/** Five steps of one hue, light → dark (sequential encoding). */
const LEVELS = [
  { className: 'bg-muted', label: 'None yet' },
  { className: 'bg-[color-mix(in_oklch,var(--primary)_22%,transparent)]', label: 'Some' },
  { className: 'bg-[color-mix(in_oklch,var(--primary)_45%,transparent)]', label: 'About half' },
  { className: 'bg-[color-mix(in_oklch,var(--primary)_72%,transparent)] text-primary-foreground', label: 'Most' },
  { className: 'bg-primary text-primary-foreground', label: 'All done' },
] as const

function heatmapLevel(value: number): number {
  if (value <= 0) return 0
  if (value >= 1) return 4
  if (value < 1 / 3) return 1
  if (value < 2 / 3) return 2
  return 3
}

function describe(day: HeatmapDay): string {
  const when = format(parseISO(day.date), 'EEEE d MMMM')
  if (day.isFuture) return `${when}: upcoming`
  if (day.description) return `${when}: ${day.description}`
  if (day.value === null) return `${when}: nothing scheduled`
  return `${when}: ${Math.round(day.value * 100)}% done`
}

/**
 * Month-style calendar coloured by completion ratio. Renders one small table per month in the
 * given days (each a real <table> with weekday headers, so it reads well with a screen reader).
 */
export function CalendarHeatmap({
  days,
  title = 'Completion calendar',
  description,
  weekStartsOn = 1,
  showTitle = true,
  className,
}: {
  days: readonly HeatmapDay[]
  title?: string
  description?: React.ReactNode
  weekStartsOn?: 0 | 1
  showTitle?: boolean
  className?: string
}) {
  const titleId = useId()
  const months = groupByMonth(days)
  const weekdayOrder = Array.from({ length: 7 }, (_, i) => (i + weekStartsOn) % 7)

  return (
    <GlassCard as="section" aria-labelledby={titleId} className={cn('space-y-3', className)}>
      <div className={cn(!showTitle && 'sr-only')}>
        <h3 id={titleId} className="font-bold leading-tight">
          {title}
        </h3>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {months.map((m) => {
          const lead = (dayOfWeek(m.days[0]!.date) - weekStartsOn + 7) % 7
          const cells: (HeatmapDay | null)[] = [...Array<null>(lead).fill(null), ...m.days]
          while (cells.length % 7) cells.push(null)
          const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7))
          return (
            <table key={m.key} className="w-full table-fixed border-separate border-spacing-1">
              <caption className="pb-1 text-left text-sm font-semibold">{m.label}</caption>
              <thead>
                <tr>
                  {weekdayOrder.map((d) => (
                    <th key={d} scope="col" abbr={WEEKDAY_LONG[d]} className="text-[10px] font-medium text-muted-foreground">
                      {WEEKDAY_SHORT[d]!.slice(0, 2)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week, wi) => (
                  <tr key={wi}>
                    {week.map((day, di) =>
                      day ? (
                        <td key={day.date} className="p-0">
                          <div
                            title={describe(day)}
                            className={cn(
                              'flex aspect-square items-center justify-center rounded-md text-[11px] font-semibold tabular-nums',
                              day.isFuture
                                ? 'border border-dashed border-border/60 text-muted-foreground/60'
                                : day.value === null
                                  ? 'border border-dashed border-border text-muted-foreground'
                                  : LEVELS[heatmapLevel(day.value)]!.className,
                            )}
                          >
                            <span aria-hidden="true">{Number(day.date.slice(8))}</span>
                            <span className="sr-only">{describe(day)}</span>
                          </div>
                        </td>
                      ) : (
                        <td key={`empty-${wi}-${di}`} aria-hidden="true" />
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )
        })}
      </div>

      <HeatmapLegend />
    </GlassCard>
  )
}

function HeatmapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <span>Less</span>
        <ul className="flex gap-1" aria-label="Colour scale from none done to all done">
          {LEVELS.map((l) => (
            <li key={l.label} className={cn('size-3.5 rounded-sm', l.className)}>
              <span className="sr-only">{l.label}</span>
            </li>
          ))}
        </ul>
        <span>More</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="size-3.5 rounded-sm border border-dashed border-border" aria-hidden="true" />
        <span>Nothing scheduled</span>
      </div>
    </div>
  )
}

function groupByMonth(days: readonly HeatmapDay[]) {
  const months: { key: string; label: string; days: HeatmapDay[] }[] = []
  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  for (const day of sorted) {
    const key = day.date.slice(0, 7)
    let month = months[months.length - 1]
    if (!month || month.key !== key) {
      month = { key, label: format(parseISO(day.date), 'MMMM yyyy'), days: [] }
      months.push(month)
    }
    month.days.push(day)
  }
  return months
}
