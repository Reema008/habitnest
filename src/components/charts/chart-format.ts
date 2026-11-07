/** Formatting & colour helpers shared by the chart components. */

const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })
const compactFormat = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

export function formatNumber(value: number): string {
  return numberFormat.format(value)
}

/** Short axis ticks: 12,500 → "12.5K". */
export function formatCompact(value: number): string {
  return Math.abs(value) >= 10_000 ? compactFormat.format(value) : numberFormat.format(value)
}

/** "7.5 hours", "8,000 steps", or just "3" for unit-less values. */
export function formatWithUnit(value: number, unit: string | null | undefined): string {
  const u = unit?.trim()
  if (!u) return formatNumber(value)
  return u === '%' ? `${formatNumber(value)}%` : `${formatNumber(value)} ${u}`
}

export function formatPercent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)}%`
}

const CHART_COLOR_COUNT = 5

/**
 * Colour for the n-th entity (member, series …). Colours follow the entity's stable position,
 * never its rank. Beyond five entities the hues repeat with a dashed stroke so identity never
 * relies on colour alone.
 */
export function seriesColor(index: number): string {
  return `var(--chart-${(index % CHART_COLOR_COUNT) + 1})`
}

export function seriesDash(index: number): string | undefined {
  return index >= CHART_COLOR_COUNT ? '6 3' : undefined
}
