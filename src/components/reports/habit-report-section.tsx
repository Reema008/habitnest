import { Archive, Lock, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { GlassCard } from '@/components/common/glass-card'
import { HabitIcon } from '@/components/common/habit-visuals'
import { BarChartCard } from '@/components/charts/bar-chart-card'
import { ProgressRing } from '@/components/charts/progress-ring'
import { formatPercent } from '@/components/charts/chart-format'
import type { DateRange, HabitReport, NumericSeries } from '@/domain/report-aggregates'
import { formatDay } from '@/lib/dates'
import type { HabitWithFields } from '@/types/models'
import { NumericSeriesCard } from './numeric-series-card'

/** Everything about one habit in the selected period. */
export function HabitReportSection({ report, chartRange }: { report: HabitReport<HabitWithFields>; chartRange: DateRange }) {
  const { habit, completion } = report
  const headingId = `habit-report-${habit.id}`
  const hasData = report.numeric.length + report.choices.length + report.texts.length > 0

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <GlassCard className="flex items-center gap-3">
        <HabitIcon icon={habit.icon} color={habit.color} />
        <div className="min-w-0 flex-1 space-y-1">
          <h3 id={headingId} className="truncate text-lg font-bold leading-tight">
            {habit.name}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {habit.visibility === 'family' ? (
              <Badge variant="secondary" className="gap-1">
                <Users className="size-3" aria-hidden /> Shared with family
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <Lock className="size-3" aria-hidden /> Private
              </Badge>
            )}
            {habit.archived_at ? (
              <Badge variant="outline" className="gap-1">
                <Archive className="size-3" aria-hidden /> Archived
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">{completionText(report)}</p>
        </div>
        {completion.percent !== null ? (
          <ProgressRing value={completion.percent} size={60} strokeWidth={6} label={`${habit.name} completion`} />
        ) : (
          <ProgressRing value={0} size={60} strokeWidth={6} label={`${habit.name}: nothing scheduled in this period`}>
            <span className="text-sm font-bold text-muted-foreground">—</span>
          </ProgressRing>
        )}
      </GlassCard>

      {report.numeric.map((s) => (
        <NumericSeriesCard key={s.key} series={s} range={chartRange} note={unitChangeNote(s, report.numeric)} />
      ))}

      {report.choices.map((c) => (
        <BarChartCard
          key={c.key}
          title={c.label}
          description={`How often each answer was chosen · ${c.total} ${c.total === 1 ? 'entry' : 'entries'}`}
          data={c.options.map((o) => ({ option: o.option, count: o.count }))}
          xKey="option"
          xHeading="Answer"
          series={[{ key: 'count', label: 'Days chosen' }]}
          unit="days"
          orientation="horizontal"
          summary={`${c.label}: ${c.options.map((o) => `${o.option} ${o.count}`).join(', ')}.`}
        />
      ))}

      {report.texts.map((t) => (
        <GlassCard as="section" key={t.key} aria-label={`${t.label} — recent entries`} className="space-y-2">
          <h4 className="font-bold">{t.label}</h4>
          <p className="text-xs text-muted-foreground">Most recent entries in this period</p>
          <ul className="divide-y divide-border/60">
            {t.items.map((item) => (
              <li key={item.date} className="py-2">
                <p className="text-xs font-semibold text-muted-foreground">{formatDay(item.date)}</p>
                <p className="whitespace-pre-wrap break-words text-sm">{item.value}</p>
              </li>
            ))}
          </ul>
        </GlassCard>
      ))}

      {!hasData && report.entryCount > 0 ? (
        <p className="px-1 text-sm text-muted-foreground">
          {report.entryCount} {report.entryCount === 1 ? 'check-in' : 'check-ins'} recorded — this habit has no values to chart.
        </p>
      ) : null}
      {report.entryCount === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">No entries in this period yet — each check-in will appear here.</p>
      ) : null}
    </section>
  )
}

function completionText(report: HabitReport<HabitWithFields>): string {
  const { scheduled, completed, bonus, percent } = report.completion
  if (scheduled === 0) {
    return bonus > 0 ? `Nothing scheduled · ${bonus} extra ${bonus === 1 ? 'day' : 'days'} done` : 'Nothing scheduled in this period'
  }
  const extra = bonus > 0 ? ` · +${bonus} extra` : ''
  return `${completed} of ${scheduled} scheduled ${scheduled === 1 ? 'day' : 'days'} done (${formatPercent(percent)})${extra}`
}

/** Explains why a field appears twice when its unit changed between versions. */
function unitChangeNote(series: NumericSeries, all: readonly NumericSeries[]): string | undefined {
  const siblings = all.filter((s) => s.fieldKey === series.fieldKey && s.key !== series.key)
  if (!siblings.length) return undefined
  const units = siblings.map((s) => s.unit ?? 'no unit').join(', ')
  return `Recorded in ${series.unit ?? 'no unit'} here; entries in ${units} are shown separately so values are never mixed.`
}
