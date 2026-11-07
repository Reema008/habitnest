import { GlassCard } from '@/components/common/glass-card'
import { Progress } from '@/components/ui/progress'
import { formatPercent, formatWithUnit } from '@/components/charts/chart-format'
import type { WeekSummary } from '@/domain/report-aggregates'
import { allowedAggregations } from '@/domain/metric-compatibility'
import { rangeLabel } from './period'

/** Per-week completion and per-metric averages inside a month. */
export function WeeklySummaryList({
  weeks,
  habitNames,
}: {
  weeks: readonly WeekSummary[]
  /** habit id → name, to label metrics when several habits are shown. */
  habitNames: ReadonlyMap<string, string>
}) {
  const showHabitName = new Set(weeks.flatMap((w) => w.metrics.map((m) => m.series.habitId))).size > 1
  return (
    <section aria-labelledby="weekly-summaries" className="space-y-2">
      <h2 id="weekly-summaries" className="px-1 text-lg font-bold">
        Week by week
      </h2>
      <ol className="space-y-2">
        {weeks.map((w) => {
          const { completed, scheduled, percent } = w.completion
          const metrics = w.metrics.filter((m) => m.summary)
          return (
            <GlassCard as="li" key={w.start} className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold">{rangeLabel(w)}</h3>
                <p className="text-lg font-extrabold tabular-nums">{formatPercent(percent)}</p>
              </div>
              {scheduled > 0 ? (
                <>
                  <Progress value={percent ?? 0} aria-label={`Completion ${rangeLabel(w)}`} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {completed} of {scheduled} scheduled check-ins done
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Nothing scheduled this week</p>
              )}
              {metrics.length ? (
                <ul className="space-y-1 border-t border-border/60 pt-2 text-sm">
                  {metrics.map(({ series, summary }) => {
                    if (!summary) return null
                    const name = showHabitName ? `${habitNames.get(series.habitId) ?? 'Habit'} · ${series.label}` : series.label
                    const canTotal = allowedAggregations(series.unit).includes('total')
                    return (
                      <li key={series.key} className="flex flex-wrap justify-between gap-x-3">
                        <span className="text-muted-foreground">{name}</span>
                        <span className="tabular-nums">
                          avg {formatWithUnit(summary.average, series.unit)} per recorded day
                          {canTotal ? ` · total ${formatWithUnit(summary.total, series.unit)}` : ''}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </GlassCard>
          )
        })}
      </ol>
    </section>
  )
}
