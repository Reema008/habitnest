import type { ChartConfig } from '@/components/ui/chart'
import type { DataTableColumn, DataTableRow } from './chart-frame'
import { formatWithUnit, seriesColor, seriesDash } from './chart-format'

export type ChartDatum = Record<string, string | number | null>

export type ChartSeries = {
  /** Property of each datum holding this series' value. */
  key: string
  label: string
  /** CSS colour; defaults to var(--chart-n) by position. */
  color?: string
  /** Dashed stroke (line charts) — used for secondary encoding beyond five series. */
  dashed?: boolean
}

export type PreparedSeries = { safeKey: string; label: string; color: string; dash: string | undefined }

/**
 * Maps arbitrary data keys (UUIDs, field keys…) to CSS-safe keys so the shadcn ChartContainer can
 * expose `--color-<key>` variables, and builds the accessible table.
 */
export function prepareChart(
  data: readonly ChartDatum[],
  xKey: string,
  series: readonly ChartSeries[],
  opts: { unit?: string | null; xLabel?: (x: string) => string; xLabelLong?: (x: string) => string; xHeading: string },
) {
  const prepared: PreparedSeries[] = series.map((s, i) => ({
    safeKey: `s${i}`,
    label: s.label,
    color: s.color ?? seriesColor(i),
    dash: s.dashed ? '6 3' : s.color ? undefined : seriesDash(i),
  }))
  const config: ChartConfig = Object.fromEntries(prepared.map((p) => [p.safeKey, { label: p.label, color: p.color }]))
  const rows = data.map((d) => {
    const row: ChartDatum = { x: d[xKey] ?? '' }
    series.forEach((s, i) => {
      const v = d[s.key]
      row[`s${i}`] = typeof v === 'number' && Number.isFinite(v) ? v : null
    })
    return row
  })
  const format = (x: string) => (opts.xLabel ? opts.xLabel(x) : x)
  const formatLong = (x: string) => (opts.xLabelLong ? opts.xLabelLong(x) : format(x))
  const columns: DataTableColumn[] = [
    { key: 'x', label: opts.xHeading },
    ...prepared.map((p) => ({ key: p.safeKey, label: opts.unit ? `${p.label} (${opts.unit})` : p.label })),
  ]
  const tableRows: DataTableRow[] = rows.map((r, i) => ({
    id: `${String(r.x)}-${i}`,
    cells: Object.fromEntries([
      ['x', formatLong(String(r.x))],
      ...prepared.map((p) => {
        const v = r[p.safeKey]
        return [p.safeKey, typeof v === 'number' ? formatWithUnit(v, opts.unit) : 'No entry']
      }),
    ]),
  }))
  return { rows, prepared, config, table: { columns, rows: tableRows }, format, formatLong }
}
