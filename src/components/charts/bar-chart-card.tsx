import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip } from '@/components/ui/chart'
import { ChartFrame } from './chart-frame'
import { prepareChart, type ChartDatum, type ChartSeries } from './chart-data'
import { formatCompact } from './chart-format'
import { UnitTooltipContent } from './chart-tooltip'

export type BarChartCardProps = {
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  data: readonly ChartDatum[]
  /** Property holding the category (date, member name, option…). */
  xKey: string
  /** Heading of the category column in the accessible table. */
  xHeading?: string
  series: readonly ChartSeries[]
  /** Unit of every value in this chart (one chart = one unit). */
  unit?: string | null
  /** Short label for axis ticks. */
  formatX?: (x: string) => string
  /** Full label for tooltips and the accessible table (defaults to formatX). */
  formatXLong?: (x: string) => string
  /** 'horizontal' draws horizontal bars — better for long category labels. */
  orientation?: 'vertical' | 'horizontal'
  /**
   * Single-series charts only: one colour per datum (e.g. each member's own colour), so the
   * bar matches the entity's colour elsewhere on the page.
   */
  barColors?: readonly string[]
  height?: number
  summary?: string
  className?: string
}

/** Theme-aware bar chart card with tooltip, unit-aware axis and a screen-reader table. */
export function BarChartCard({
  title,
  description,
  action,
  data,
  xKey,
  xHeading = 'Category',
  series,
  unit,
  formatX,
  formatXLong,
  orientation = 'vertical',
  barColors,
  height,
  summary,
  className,
}: BarChartCardProps) {
  const { rows, prepared, config, table, format, formatLong } = prepareChart(data, xKey, series, {
    unit,
    xLabel: formatX,
    xLabelLong: formatXLong,
    xHeading,
  })
  const horizontal = orientation === 'horizontal'
  const chartHeight = height ?? (horizontal ? Math.max(120, rows.length * 40 + 40) : 220)

  return (
    <ChartFrame title={title} description={description} action={action} summary={summary} table={table} className={className}>
      {unit ? <p className="mb-1 text-[11px] font-medium text-muted-foreground">{horizontal ? `Values in ${unit}` : unit}</p> : null}
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height: chartHeight }}>
        <BarChart
          data={rows}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
          barGap={2}
          accessibilityLayer={false}
        >
          <CartesianGrid vertical={horizontal} horizontal={!horizontal} strokeDasharray="3 3" />
          {horizontal ? (
            <>
              <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={formatCompact} allowDecimals />
              <YAxis
                type="category"
                dataKey="x"
                tickLine={false}
                axisLine={false}
                width={96}
                tickFormatter={(v: string | number) => truncate(format(String(v)), 14)}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey="x"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={12}
                tickFormatter={(v: string | number) => truncate(format(String(v)), 10)}
              />
              <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={formatCompact} />
            </>
          )}
          <ChartTooltip cursor content={<UnitTooltipContent unit={unit} series={prepared} formatLabel={formatLong} />} />
          {prepared.length > 1 ? <ChartLegend content={<ChartLegendContent className="flex-wrap" />} /> : null}
          {prepared.map((p) => (
            <Bar
              key={p.safeKey}
              dataKey={p.safeKey}
              name={p.safeKey}
              fill={`var(--color-${p.safeKey})`}
              radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              maxBarSize={horizontal ? 24 : 32}
              isAnimationActive={false}
            >
              {barColors && prepared.length === 1
                ? rows.map((_, i) => <Cell key={i} fill={barColors[i] ?? `var(--color-${p.safeKey})`} />)
                : null}
            </Bar>
          ))}
        </BarChart>
      </ChartContainer>
    </ChartFrame>
  )
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
