/**
 * Groups rows of the `family_metric_series` RPC into metrics that can fairly be compared
 * between family members.
 *
 * Two rows are the same metric only when they describe the same habit (same template, or the same
 * habit name when not created from a template), the same field (template field_key, or the same
 * field label for custom habits) AND the same unit (case-insensitive, trimmed). Rows with different
 * units are always different metrics — values are never converted or combined across units.
 */
import { summarize, cleanNumber, normalizeUnit, type NumericSummary } from './report-aggregates'
import type { ISODate } from '@/lib/dates'

/** One row as returned by family_metric_series (generated types mark every column nullable). */
export type MetricSeriesRow = {
  user_id: string | null
  habit_id: string | null
  habit_name: string | null
  template_key: string | null
  field_key: string | null
  field_label: string | null
  unit: string | null
  entry_date: string | null
  value: number | null
  is_complete: boolean | null
}

export type MemberMetricSeries = {
  userId: string
  /** One value per recorded day, ascending by date. */
  values: { date: ISODate; value: number }[]
  summary: NumericSummary
}

export type ComparableMetric = {
  key: string
  /** e.g. "Walking · steps". */
  label: string
  habitName: string
  fieldLabel: string
  /** Display unit, or null for unit-less numbers. */
  unit: string | null
  /** Members with at least one value, in first-seen order. */
  members: MemberMetricSeries[]
  /** Every date that has a value for any member, ascending. */
  dates: ISODate[]
}

/** Lower-case, trimmed, inner whitespace collapsed. */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Grouping key of a row, or null if the row lacks what is needed to compare it. */
export function metricKey(row: Pick<MetricSeriesRow, 'template_key' | 'habit_name' | 'field_key' | 'field_label' | 'unit'>): string | null {
  const template = normalizeText(row.template_key)
  const habit = template ? `t:${template}` : normalizeText(row.habit_name) ? `n:${normalizeText(row.habit_name)}` : null
  if (!habit) return null
  // Template habits share stable field keys; custom habits are matched by what members called the field.
  const field = template
    ? normalizeText(row.field_key)
    : normalizeText(row.field_label) || normalizeText(row.field_key)
  if (!field) return null
  return `${habit}|${field}|u:${normalizeUnit(row.unit)}`
}

type Builder = {
  key: string
  habitNames: Map<string, number>
  fieldLabels: Map<string, number>
  unit: string | null
  /** userId → date → summed value (same metric & unit only). */
  values: Map<string, Map<ISODate, number>>
}

function vote(map: Map<string, number>, value: string | null | undefined) {
  const v = (value ?? '').trim()
  if (v) map.set(v, (map.get(v) ?? 0) + 1)
}

function mostCommon(map: Map<string, number>, fallback: string): string {
  let best = fallback
  let bestCount = 0
  for (const [value, count] of map) {
    if (count > bestCount) {
      best = value
      bestCount = count
    }
  }
  return best
}

/**
 * Groups rows into comparable metrics. If a member has two shared habits that map onto the same
 * metric (same name/template, field and unit) their values on the same day are added together.
 */
export function groupComparableMetrics(rows: readonly MetricSeriesRow[]): ComparableMetric[] {
  const builders = new Map<string, Builder>()
  for (const row of rows) {
    if (!row.user_id || !row.entry_date || row.value === null || !Number.isFinite(row.value)) continue
    const key = metricKey(row)
    if (!key) continue
    let b = builders.get(key)
    if (!b) {
      b = { key, habitNames: new Map(), fieldLabels: new Map(), unit: row.unit?.trim() || null, values: new Map() }
      builders.set(key, b)
    }
    vote(b.habitNames, row.habit_name)
    vote(b.fieldLabels, row.field_label)
    let byDate = b.values.get(row.user_id)
    if (!byDate) b.values.set(row.user_id, (byDate = new Map()))
    byDate.set(row.entry_date, cleanNumber((byDate.get(row.entry_date) ?? 0) + row.value))
  }

  const metrics: ComparableMetric[] = [...builders.values()].map((b) => {
    const habitName = mostCommon(b.habitNames, 'Habit')
    const fieldLabel = mostCommon(b.fieldLabels, habitName)
    const dates = new Set<ISODate>()
    const members: MemberMetricSeries[] = []
    for (const [userId, byDate] of b.values) {
      const values = [...byDate]
        .map(([date, value]) => ({ date, value }))
        .sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0))
      values.forEach((v) => dates.add(v.date))
      const summary = summarize(values.map((v) => v.value))
      if (summary) members.push({ userId, values, summary })
    }
    return {
      key: b.key,
      label: `${habitName} · ${b.unit ?? fieldLabel}`,
      habitName,
      fieldLabel,
      unit: b.unit,
      members,
      dates: [...dates].sort(),
    }
  })

  // Disambiguate metrics that would otherwise read the same (e.g. two fields with the same unit).
  const labelCounts = new Map<string, number>()
  metrics.forEach((m) => labelCounts.set(m.label, (labelCounts.get(m.label) ?? 0) + 1))
  for (const m of metrics) {
    if ((labelCounts.get(m.label) ?? 0) > 1) {
      m.label = m.unit ? `${m.habitName} · ${m.fieldLabel} (${m.unit})` : `${m.habitName} · ${m.fieldLabel}`
    }
  }
  // Still identical (e.g. a template habit and a custom habit with the same name): number them.
  const seen = new Map<string, number>()
  const finalCounts = new Map<string, number>()
  metrics.forEach((m) => finalCounts.set(m.label, (finalCounts.get(m.label) ?? 0) + 1))
  for (const m of metrics) {
    if ((finalCounts.get(m.label) ?? 0) < 2) continue
    const n = (seen.get(m.label) ?? 0) + 1
    seen.set(m.label, n)
    m.label = `${m.label} (${n})`
  }

  return metrics
    .filter((m) => m.members.length > 0)
    .sort((a, b) => b.members.length - a.members.length || a.label.localeCompare(b.label))
}

// ---------------------------------------------------------------------------
// How to aggregate a metric over a period
// ---------------------------------------------------------------------------

export type MetricAggregation = 'total' | 'average'

/** Units where adding days together is meaningful (steps walked, litres drunk, hours slept …). */
const ADDITIVE_UNITS = new Set([
  'step', 'steps', 'l', 'litre', 'litres', 'liter', 'liters', 'ml', 'millilitre', 'millilitres', 'milliliter',
  'milliliters', 'glass', 'glasses', 'cup', 'cups', 'h', 'hr', 'hrs', 'hour', 'hours', 'min', 'mins', 'minute',
  'minutes', 's', 'sec', 'secs', 'second', 'seconds', 'km', 'kilometre', 'kilometres', 'kilometer', 'kilometers',
  'mi', 'mile', 'miles', 'm', 'metre', 'metres', 'meter', 'meters', 'page', 'pages', 'chapter', 'chapters',
  'rep', 'reps', 'set', 'sets', 'kcal', 'cal', 'calories', 'times', 'pieces', 'servings', 'portions', 'words',
  'lessons', 'books', 'laps',
])

/** Units that describe a level/state, where only the per-day average makes sense (weight, mood score …). */
const LEVEL_UNITS = new Set([
  'kg', 'kgs', 'kilogram', 'kilograms', 'lb', 'lbs', 'pound', 'pounds', 'st', 'stone', 'bpm', '%', 'percent',
  '°c', '°f', 'c', 'f', 'celsius', 'fahrenheit', 'score', 'rating', 'level', 'mood', '/10', 'out of 10', '/5',
  'out of 5', 'mmhg', 'mg/dl', 'mmol/l', 'cm', 'inch', 'inches', 'in',
])

/** Aggregations that make sense for a unit. Level-like units are never summed. */
export function allowedAggregations(unit: string | null | undefined): MetricAggregation[] {
  return LEVEL_UNITS.has(normalizeUnit(unit)) ? ['average'] : ['total', 'average']
}

export function defaultAggregation(unit: string | null | undefined): MetricAggregation {
  const u = normalizeUnit(unit)
  if (LEVEL_UNITS.has(u)) return 'average'
  if (ADDITIVE_UNITS.has(u)) return 'total'
  return 'average'
}

export function aggregateValue(summary: NumericSummary, aggregation: MetricAggregation): number {
  return aggregation === 'total' ? summary.total : summary.average
}
