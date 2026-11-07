import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ChartNoAxesColumn, Lock, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { GlassCard } from '@/components/common/glass-card'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { UserAvatar } from '@/components/common/user-avatar'
import { BarChartCard } from '@/components/charts/bar-chart-card'
import { LineChartCard } from '@/components/charts/line-chart-card'
import { formatWithUnit, seriesColor, seriesDash } from '@/components/charts/chart-format'
import {
  aggregateValue, allowedAggregations, defaultAggregation, type ComparableMetric, type MemberMetricSeries,
  type MetricAggregation,
} from '@/domain/metric-compatibility'
import type { DateRange } from '@/domain/report-aggregates'
import { useMyFamily } from '@/hooks/use-family'
import { useComparableMetrics } from '@/hooks/use-reports'
import { eachDay, todayISO } from '@/lib/dates'
import type { FamilyMemberWithProfile } from '@/types/models'
import { clipToToday, longDay, shortDay } from './period'

const AGGREGATION_LABEL: Record<MetricAggregation, string> = { total: 'Total', average: 'Daily average' }

/** Explains what family comparisons may include. */
export function PrivacyNote() {
  return (
    <GlassCard className="flex items-start gap-3 text-sm">
      <Lock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <p className="text-muted-foreground">
        Only habits members chose to share are compared. Private habits are never included.
      </p>
    </GlassCard>
  )
}

/**
 * Compares family members on one compatible metric (same habit, field and unit) for a period.
 * Used by /family/compare and the Family scope of /reports.
 */
export function FamilyComparison({ range }: { range: DateRange }) {
  const family = useMyFamily()
  const inFamily = !!family.data
  const metricsQuery = useComparableMetrics(range.start, range.end, { enabled: inFamily })
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [aggregationChoice, setAggregationChoice] = useState<MetricAggregation | null>(null)

  if (family.error) return <ErrorState error={family.error} onRetry={() => void family.refetch()} />
  if (family.isPending) return <LoadingState rows={3} />
  if (!family.data) {
    return (
      <EmptyState
        icon={Users}
        title="Compare with your family"
        description="Create or join a family to see shared habits side by side."
        action={
          <Button asChild className="h-11 rounded-xl">
            <Link to="/family">Go to family</Link>
          </Button>
        }
      />
    )
  }
  if (metricsQuery.error) return <ErrorState error={metricsQuery.error} onRetry={() => void metricsQuery.refetch()} />
  if (metricsQuery.isPending || !metricsQuery.metrics) return <LoadingState rows={3} />

  const metrics = metricsQuery.metrics
  if (!metrics.length) {
    return (
      <div className="space-y-3">
        <EmptyState
          icon={ChartNoAxesColumn}
          title="Nothing shared to compare yet"
          description="Comparisons use habits with numbers (like steps, water or sleep) that members share with the family. Set a habit to “Shared with family” and log it — it will show up here for this period."
          action={
            <Button asChild variant="secondary" className="h-11 rounded-xl">
              <Link to="/habits">Review my habits</Link>
            </Button>
          }
        />
        <PrivacyNote />
      </div>
    )
  }

  const metric = metrics.find((m) => m.key === selectedKey) ?? metrics[0]!
  const allowed = allowedAggregations(metric.unit)
  const aggregation = aggregationChoice && allowed.includes(aggregationChoice) ? aggregationChoice : defaultAggregation(metric.unit)

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="compare-metric">What to compare</Label>
        <Select
          value={metric.key}
          onValueChange={(v) => {
            setSelectedKey(v)
            setAggregationChoice(null)
          }}
        >
          <SelectTrigger id="compare-metric" className="h-11 w-full rounded-xl bg-glass">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {metrics.map((m) => (
              <SelectItem key={m.key} value={m.key} className="min-h-11">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Only metrics recorded in the same unit are offered, so the numbers always line up.</p>
      </div>

      {allowed.length > 1 ? (
        <ToggleGroup
          type="single"
          value={aggregation}
          onValueChange={(v) => {
            if (v === 'total' || v === 'average') setAggregationChoice(v)
          }}
          aria-label="Show totals or daily averages"
          spacing={0}
          className="glass w-full rounded-2xl p-1"
        >
          {allowed.map((a) => (
            <ToggleGroupItem
              key={a}
              value={a}
              className="h-11 flex-1 rounded-xl data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              {AGGREGATION_LABEL[a]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      ) : null}

      <ComparisonCharts metric={metric} members={family.data.members} aggregation={aggregation} range={range} />
      <PrivacyNote />
    </div>
  )
}

function ComparisonCharts({
  metric,
  members,
  aggregation,
  range,
}: {
  metric: ComparableMetric
  members: readonly FamilyMemberWithProfile[]
  aggregation: MetricAggregation
  range: DateRange
}) {
  const today = todayISO()
  const chartRange = clipToToday(range, today)
  const days = chartRange.start <= chartRange.end ? eachDay(chartRange.start, chartRange.end) : []

  // Colour follows each member's stable position in the family, never their rank.
  const entries = useMemo(
    () =>
      members.map((m, index) => ({
        member: m,
        index,
        color: seriesColor(index),
        dashed: !!seriesDash(index),
        series: metric.members.find((s) => s.userId === m.user_id) ?? null,
      })),
    [members, metric],
  )
  const withData = entries.filter((e): e is typeof e & { series: MemberMetricSeries } => e.series !== null)
  const aggLabel = aggregation === 'total' ? 'Total' : 'Average per recorded day'

  const barData = withData.map((e) => ({ name: e.member.profile.display_name, value: aggregateValue(e.series.summary, aggregation) }))
  const lineData = days.map((date) => {
    const row: Record<string, string | number | null> = { date }
    for (const e of withData) row[e.member.user_id] = e.series.values.find((v) => v.date === date)?.value ?? null
    return row
  })

  return (
    <div className="space-y-4">
      <BarChartCard
        title={`${metric.label} · ${aggLabel.toLowerCase()}`}
        description={aggregation === 'total' ? 'Everything recorded in this period' : 'Averaged over the days each member recorded'}
        data={barData}
        xKey="name"
        xHeading="Member"
        series={[{ key: 'value', label: aggLabel }]}
        barColors={withData.map((e) => e.color)}
        unit={metric.unit}
        orientation="horizontal"
        summary={barData.map((d) => `${d.name}: ${formatWithUnit(d.value, metric.unit)}`).join('; ')}
      />

      {days.length > 1 ? (
        <div className="space-y-2">
          <LineChartCard
            title={`${metric.label} · day by day`}
            description="Days without an entry are left blank"
            data={lineData}
            xKey="date"
            xHeading="Day"
            series={withData.map((e) => ({ key: e.member.user_id, label: e.member.profile.display_name, color: e.color, dashed: e.dashed }))}
            unit={metric.unit}
            formatX={shortDay}
            formatXLong={longDay}
            hideLegend
          />
          <ul className="flex flex-wrap gap-2" aria-label="Chart legend">
            {withData.map((e) => (
              <li key={e.member.user_id} className="glass flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm">
                <UserAvatar profile={e.member.profile} className="size-7" />
                <span
                  className="h-0.5 w-4 rounded"
                  style={{ background: e.dashed ? `repeating-linear-gradient(90deg, ${e.color} 0 4px, transparent 4px 6px)` : e.color }}
                  aria-hidden
                />
                <span>{e.member.profile.display_name}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <section aria-labelledby="member-summaries" className="space-y-2">
        <h3 id="member-summaries" className="px-1 font-bold">
          Member summaries
        </h3>
        <ul className="space-y-2">
          {entries.map((e) => (
            <GlassCard as="li" key={e.member.user_id} className="flex items-start gap-3">
              <div className="relative">
                <UserAvatar profile={e.member.profile} />
                <span
                  className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full ring-2 ring-background"
                  style={{ background: e.color }}
                  aria-hidden
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{e.member.profile.display_name}</p>
                {e.series ? (
                  <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                    {allowedAggregations(metric.unit).includes('total') ? (
                      <MemberStat label="Total" value={formatWithUnit(e.series.summary.total, metric.unit)} />
                    ) : null}
                    <MemberStat label="Avg per recorded day" value={formatWithUnit(e.series.summary.average, metric.unit)} />
                    <MemberStat label="Days recorded" value={String(e.series.summary.count)} />
                    <MemberStat label="Best day" value={formatWithUnit(e.series.summary.max, metric.unit)} />
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground">No shared entries for this in this period.</p>
                )}
              </div>
            </GlassCard>
          ))}
        </ul>
      </section>
    </div>
  )
}

function MemberStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
