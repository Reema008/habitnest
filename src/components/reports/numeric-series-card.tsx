import { useState } from 'react'
import { ChartColumn, ChartLine } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { BarChartCard } from '@/components/charts/bar-chart-card'
import { LineChartCard } from '@/components/charts/line-chart-card'
import { formatWithUnit } from '@/components/charts/chart-format'
import { dailyValues, type DateRange, type NumericSeries } from '@/domain/report-aggregates'
import { allowedAggregations } from '@/domain/metric-compatibility'
import { longDay, shortDay } from './period'

type ChartType = 'line' | 'bar'

/**
 * One numeric field (one field_key + one unit) of a habit: daily chart plus total / average /
 * lowest / highest. A field whose unit changed between versions arrives here as separate series.
 */
export function NumericSeriesCard({
  series,
  range,
  note,
}: {
  series: NumericSeries
  /** Days to plot (already clipped to today). */
  range: DateRange
  note?: string
}) {
  const [chartType, setChartType] = useState<ChartType>('line')
  const data = dailyValues(series, range).map((d) => ({ date: d.date, value: d.value }))
  const title = series.unit ? `${series.label} (${series.unit})` : series.label
  const s = series.summary
  const canTotal = allowedAggregations(series.unit).includes('total')
  const chartSeries = [{ key: 'value', label: series.label }]
  const summaryText = s
    ? `${series.label}: recorded on ${s.count} ${s.count === 1 ? 'day' : 'days'}, average ${formatWithUnit(s.average, series.unit)} per recorded day, lowest ${formatWithUnit(s.min, series.unit)}, highest ${formatWithUnit(s.max, series.unit)}.`
    : undefined

  const toggle = (
    <ToggleGroup
      type="single"
      value={chartType}
      onValueChange={(v) => {
        if (v === 'line' || v === 'bar') setChartType(v)
      }}
      aria-label={`Chart type for ${series.label}`}
      spacing={0}
      className="rounded-xl bg-muted p-0.5"
    >
      <ToggleGroupItem value="line" aria-label="Line chart" className="size-11 rounded-lg data-[state=on]:bg-background">
        <ChartLine className="size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="bar" aria-label="Bar chart" className="size-11 rounded-lg data-[state=on]:bg-background">
        <ChartColumn className="size-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  )

  const common = {
    title,
    description: note ?? 'Daily values · days without an entry are left blank',
    action: toggle,
    data,
    xKey: 'date',
    xHeading: 'Day',
    series: chartSeries,
    unit: series.unit,
    formatX: shortDay,
    formatXLong: longDay,
    summary: summaryText,
  }

  return (
    <div className="space-y-2">
      {chartType === 'line' ? (
        <LineChartCard {...common} />
      ) : (
        <BarChartCard {...common} />
      )}
      {s ? (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {canTotal ? <Stat label="Total" value={formatWithUnit(s.total, series.unit)} /> : null}
          <Stat label="Average per recorded day" value={formatWithUnit(s.average, series.unit)} />
          <Stat label="Lowest" value={formatWithUnit(s.min, series.unit)} />
          <Stat label="Highest" value={formatWithUnit(s.max, series.unit)} />
          <Stat label="Days recorded" value={String(s.count)} />
        </dl>
      ) : null}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/60 px-3 py-2">
      <dt className="text-[11px] font-medium text-muted-foreground">{label}</dt>
      <dd className="font-bold tabular-nums">{value}</dd>
    </div>
  )
}
