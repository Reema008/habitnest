import { ChartTooltipContent } from '@/components/ui/chart'
import type { PreparedSeries } from './chart-data'
import { formatWithUnit } from './chart-format'

type TooltipContentProps = React.ComponentProps<typeof ChartTooltipContent>

/** Tooltip body that always states the unit and the series name next to its colour. */
export function UnitTooltipContent({
  unit,
  series,
  formatLabel,
  ...props
}: TooltipContentProps & {
  unit?: string | null
  series: readonly PreparedSeries[]
  formatLabel: (x: string) => string
}) {
  return (
    <ChartTooltipContent
      {...props}
      labelFormatter={(_value, payload) => {
        const x = payload?.[0]?.payload as { x?: unknown } | undefined
        return formatLabel(String(x?.x ?? ''))
      }}
      formatter={(value, name, item) => {
        const s = series.find((p) => p.safeKey === String(name))
        const text = typeof value === 'number' ? formatWithUnit(value, unit) : String(value)
        return (
          <div className="flex w-full items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: s?.color ?? item.color }} aria-hidden />
            <span className="flex-1 text-muted-foreground">{s?.label ?? String(name)}</span>
            <span className="font-mono font-medium tabular-nums text-foreground">{text}</span>
          </div>
        )
      }}
    />
  )
}
