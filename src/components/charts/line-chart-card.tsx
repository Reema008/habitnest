import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip } from '@/components/ui/chart'
import { ChartFrame } from './chart-frame'
import { prepareChart, type ChartDatum, type ChartSeries } from './chart-data'
import { formatCompact } from './chart-format'
import { UnitTooltipContent } from './chart-tooltip'

export type LineChartCardProps = {
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  data: readonly ChartDatum[]
  /** Property holding the x value (usually an ISO date). */
  xKey: string
  xHeading?: string
  series: readonly ChartSeries[]
  /** Unit of every value in this chart (one chart = one unit). */
  unit?: string | null
  /** Short label for axis ticks. */
  formatX?: (x: string) => string
  /** Full label for tooltips and the accessible table (defaults to formatX). */
  formatXLong?: (x: string) => string
  /** Hide the built-in legend (e.g. when the page renders its own legend with avatars). */
  hideLegend?: boolean
  height?: number
  summary?: string
  className?: string
}

/**
 * Theme-aware line chart card. Missing values stay as gaps (never drawn as zero); dots keep
 * isolated values visible.
 */
export function LineChartCard({
  title,
  description,
  action,
  data,
  xKey,
  xHeading = 'Date',
  series,
  unit,
  formatX,
  formatXLong,
  hideLegend,
  height = 220,
  summary,
  className,
}: LineChartCardProps) {
  const { rows, prepared, config, table, format, formatLong } = prepareChart(data, xKey, series, {
    unit,
    xLabel: formatX,
    xLabelLong: formatXLong,
    xHeading,
  })
  return (
    <ChartFrame title={title} description={description} action={action} summary={summary} table={table} className={className}>
      {unit ? <p className="mb-1 text-[11px] font-medium text-muted-foreground">{unit}</p> : null}
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} accessibilityLayer={false}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="x"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={16}
            tickFormatter={(v: string | number) => format(String(v))}
          />
          <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={formatCompact} />
          <ChartTooltip content={<UnitTooltipContent unit={unit} series={prepared} formatLabel={formatLong} indicator="line" />} />
          {prepared.length > 1 && !hideLegend ? <ChartLegend content={<ChartLegendContent className="flex-wrap" />} /> : null}
          {prepared.map((p) => (
            <Line
              key={p.safeKey}
              dataKey={p.safeKey}
              name={p.safeKey}
              type="linear"
              stroke={`var(--color-${p.safeKey})`}
              strokeWidth={2}
              strokeDasharray={p.dash}
              dot={{ r: rows.length > 62 ? 1.5 : 3, fill: `var(--color-${p.safeKey})`, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ChartContainer>
    </ChartFrame>
  )
}
