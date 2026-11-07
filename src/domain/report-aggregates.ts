/**
 * Pure report calculations for a member's own habits.
 *
 * Rules that keep the numbers honest:
 * - Every entry is interpreted with the field definitions of *its own* habit_version.
 * - Numeric values are only ever combined when they share the same field_key AND the same
 *   (normalised) unit. A field whose unit changed between versions becomes two series.
 * - Completion is measured over *scheduled* days only (habits.frequency_days), never before the
 *   habit existed, never after it was archived and never after today.
 */
import { addDays, parseISO, startOfWeek } from 'date-fns'
import { dayOfWeek, daysBetween, eachDay, toISODate, type ISODate } from '@/lib/dates'
import type { FieldDefinition, FieldType, Habit, HabitEntry, Json } from '@/types/models'

// ---------------------------------------------------------------------------
// Input shapes (subsets of the DB rows so callers and tests can pass plain objects)
// ---------------------------------------------------------------------------

export type ReportHabit = Pick<Habit, 'id' | 'name' | 'frequency_days' | 'created_at' | 'archived_at'>
export type ReportFieldDef = Pick<
  FieldDefinition,
  'habit_id' | 'version' | 'field_key' | 'label' | 'field_type' | 'unit' | 'options' | 'sort_order'
>
export type ReportEntry = Pick<HabitEntry, 'habit_id' | 'entry_date' | 'habit_version' | 'field_values' | 'is_complete'>

export type DateRange = { start: ISODate; end: ISODate }

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Unit used for grouping: trimmed, lower-case, inner whitespace collapsed; '' when absent. */
export function normalizeUnit(unit: string | null | undefined): string {
  return (unit ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Removes binary floating point noise (0.1 + 0.2) without hiding real decimals. */
export function cleanNumber(n: number): number {
  return Math.round(n * 1e9) / 1e9
}

/** Local calendar day of a timestamp (habits.created_at / archived_at). */
export function localDayOf(timestamp: string): ISODate {
  return toISODate(new Date(timestamp))
}

function fieldValuesOf(json: Json): Record<string, Json | undefined> {
  return json !== null && typeof json === 'object' && !Array.isArray(json) ? json : {}
}

/** Numeric value of a stored field, or null when it is missing / not a finite number. */
export function numericValue(raw: Json | undefined): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function textValue(raw: Json | undefined): string | null {
  if (typeof raw === 'string') return raw.trim() === '' ? null : raw.trim()
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw)
  return null
}

/** Field definitions indexed by habit id → version → definitions (sorted). */
export type DefinitionIndex = Map<string, Map<number, ReportFieldDef[]>>

export function indexDefinitions(defs: readonly ReportFieldDef[]): DefinitionIndex {
  const index: DefinitionIndex = new Map()
  for (const d of defs) {
    let byVersion = index.get(d.habit_id)
    if (!byVersion) index.set(d.habit_id, (byVersion = new Map()))
    const list = byVersion.get(d.version) ?? []
    list.push(d)
    byVersion.set(d.version, list)
  }
  for (const byVersion of index.values()) {
    for (const list of byVersion.values()) list.sort((a, b) => a.sort_order - b.sort_order)
  }
  return index
}

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

export type NumericSummary = {
  /** Number of recorded days (one value per day). */
  count: number
  total: number
  /** Average per recorded day. */
  average: number
  min: number
  max: number
}

export function summarize(values: readonly number[]): NumericSummary | null {
  if (!values.length) return null
  let total = 0
  let min = Infinity
  let max = -Infinity
  for (const v of values) {
    total += v
    if (v < min) min = v
    if (v > max) max = v
  }
  return {
    count: values.length,
    total: cleanNumber(total),
    average: cleanNumber(total / values.length),
    min,
    max,
  }
}

export function percent(part: number, whole: number): number | null {
  return whole > 0 ? cleanNumber((part / whole) * 100) : null
}

// ---------------------------------------------------------------------------
// Scheduling & completion
// ---------------------------------------------------------------------------

/**
 * Whether `day` counts as a scheduled day for the habit within the report.
 * The day the habit was archived only counts if it was completed (archiving is not a miss).
 */
export function isScheduledDay(
  habit: ReportHabit,
  day: ISODate,
  today: ISODate,
  completedOnDay: boolean,
): boolean {
  if (day > today) return false
  if (day < localDayOf(habit.created_at)) return false
  if (habit.archived_at) {
    const archivedDay = localDayOf(habit.archived_at)
    if (day > archivedDay) return false
    if (day === archivedDay && !completedOnDay) return false
  }
  return habit.frequency_days.includes(dayOfWeek(day))
}

/** Set of `${habitId}|${date}` keys with a completed entry. */
function completedKeys(entries: readonly ReportEntry[]): Set<string> {
  const keys = new Set<string>()
  for (const e of entries) if (e.is_complete) keys.add(`${e.habit_id}|${e.entry_date}`)
  return keys
}

export type DayCompletion = {
  date: ISODate
  /** Habit check-ins scheduled that day. */
  scheduled: number
  /** Scheduled check-ins that were completed. */
  completed: number
  /** completed / scheduled (0–1), or null when nothing was scheduled. */
  ratio: number | null
  /** Completed check-ins on a day the habit was not scheduled (a bonus, not part of the ratio). */
  bonus: number
  isFuture: boolean
}

export function completionByDay(
  habits: readonly ReportHabit[],
  entries: readonly ReportEntry[],
  range: DateRange,
  today: ISODate,
): DayCompletion[] {
  const done = completedKeys(entries)
  return eachDay(range.start, range.end).map((date) => {
    let scheduled = 0
    let completed = 0
    let bonus = 0
    for (const h of habits) {
      const isDone = done.has(`${h.id}|${date}`)
      if (isScheduledDay(h, date, today, isDone)) {
        scheduled++
        if (isDone) completed++
      } else if (isDone && date <= today) {
        bonus++
      }
    }
    return { date, scheduled, completed, ratio: scheduled ? completed / scheduled : null, bonus, isFuture: date > today }
  })
}

export type CompletionStats = {
  scheduled: number
  completed: number
  /** 0–100, or null when nothing was scheduled. */
  percent: number | null
  bonus: number
}

export function completionForHabit(
  habit: ReportHabit,
  entries: readonly ReportEntry[],
  range: DateRange,
  today: ISODate,
): CompletionStats {
  const own = entries.filter((e) => e.habit_id === habit.id)
  return totalCompletion(completionByDay([habit], own, range, today))
}

export function totalCompletion(days: readonly DayCompletion[]): CompletionStats {
  let scheduled = 0
  let completed = 0
  let bonus = 0
  for (const d of days) {
    scheduled += d.scheduled
    completed += d.completed
    bonus += d.bonus
  }
  return { scheduled, completed, percent: percent(completed, scheduled), bonus }
}

// ---------------------------------------------------------------------------
// Numeric series (per field_key + unit)
// ---------------------------------------------------------------------------

export type NumericPoint = { date: ISODate; value: number }

export type NumericSeries = {
  /** Stable key: habitId | field_key | normalised unit. */
  key: string
  habitId: string
  fieldKey: string
  /** Label from the newest version that used this field_key + unit. */
  label: string
  /** Display unit (newest spelling), or null when the field has no unit. */
  unit: string | null
  points: NumericPoint[]
  summary: NumericSummary | null
  /** Versions whose definitions fed this series. */
  versions: number[]
}

export function numericSeriesForHabit(
  habitId: string,
  index: DefinitionIndex,
  entries: readonly ReportEntry[],
): NumericSeries[] {
  const byVersion = index.get(habitId)
  if (!byVersion) return []
  const series = new Map<string, NumericSeries & { labelVersion: number }>()
  const ordered = entries.filter((e) => e.habit_id === habitId).sort((a, b) => (a.entry_date < b.entry_date ? -1 : 1))
  for (const entry of ordered) {
    const defs = byVersion.get(entry.habit_version)
    if (!defs) continue // cannot interpret an entry without its own version's definitions
    const values = fieldValuesOf(entry.field_values)
    for (const def of defs) {
      if (def.field_type !== 'number') continue
      const value = numericValue(values[def.field_key])
      if (value === null) continue
      const key = `${habitId}|${def.field_key}|${normalizeUnit(def.unit)}`
      let s = series.get(key)
      if (!s) {
        s = {
          key,
          habitId,
          fieldKey: def.field_key,
          label: def.label,
          unit: def.unit?.trim() ? def.unit.trim() : null,
          points: [],
          summary: null,
          versions: [],
          labelVersion: def.version,
        }
        series.set(key, s)
      }
      if (def.version >= s.labelVersion) {
        s.label = def.label
        s.unit = def.unit?.trim() ? def.unit.trim() : null
        s.labelVersion = def.version
      }
      if (!s.versions.includes(def.version)) s.versions.push(def.version)
      s.points.push({ date: entry.entry_date, value })
    }
  }
  const sortOrder = fieldSortOrder(byVersion)
  return [...series.values()]
    .map(({ labelVersion: _labelVersion, ...s }) => ({
      ...s,
      versions: s.versions.sort((a, b) => a - b),
      summary: summarize(s.points.map((p) => p.value)),
    }))
    .sort(
      (a, b) =>
        (sortOrder.get(a.fieldKey) ?? 0) - (sortOrder.get(b.fieldKey) ?? 0) ||
        Math.max(...b.versions) - Math.max(...a.versions),
    )
}

/** Sort position of each field_key in the newest version that has it. */
function fieldSortOrder(byVersion: Map<number, ReportFieldDef[]>): Map<string, number> {
  const order = new Map<string, number>()
  const newestFirst = [...byVersion.keys()].sort((a, b) => b - a)
  newestFirst.forEach((version, rank) => {
    for (const d of byVersion.get(version) ?? []) {
      if (!order.has(d.field_key)) order.set(d.field_key, rank * 1000 + d.sort_order)
    }
  })
  return order
}

/** One value per day in the range; days without a value are null (gaps, not zeros). */
export function dailyValues(series: NumericSeries, range: DateRange): { date: ISODate; value: number | null }[] {
  const byDate = new Map(series.points.map((p) => [p.date, p.value]))
  return eachDay(range.start, range.end).map((date) => ({ date, value: byDate.get(date) ?? null }))
}

/** Summary of a series restricted to a sub-range (used for weekly buckets). */
export function summarizeInRange(series: NumericSeries, range: DateRange): NumericSummary | null {
  return summarize(series.points.filter((p) => p.date >= range.start && p.date <= range.end).map((p) => p.value))
}

// ---------------------------------------------------------------------------
// Choice distributions (radio / dropdown) and text values
// ---------------------------------------------------------------------------

export type ChoiceDistribution = {
  key: string
  habitId: string
  fieldKey: string
  label: string
  /** Options of the newest version first (incl. zero counts), then any older options that were chosen. */
  options: { option: string; count: number }[]
  total: number
}

const CHOICE_TYPES: readonly FieldType[] = ['radio', 'dropdown']

export function choiceDistributionsForHabit(
  habitId: string,
  index: DefinitionIndex,
  entries: readonly ReportEntry[],
): ChoiceDistribution[] {
  const byVersion = index.get(habitId)
  if (!byVersion) return []
  const versions = [...byVersion.keys()].sort((a, b) => b - a)
  const result = new Map<string, ChoiceDistribution & { counts: Map<string, number> }>()

  // Seed with the newest definition of each choice field so known options appear with 0.
  for (const v of versions) {
    for (const d of byVersion.get(v) ?? []) {
      if (!CHOICE_TYPES.includes(d.field_type) || result.has(d.field_key)) continue
      result.set(d.field_key, {
        key: `${habitId}|${d.field_key}|choice`,
        habitId,
        fieldKey: d.field_key,
        label: d.label,
        options: [],
        total: 0,
        counts: new Map(d.options.map((o) => [o, 0])),
      })
    }
  }

  for (const entry of entries) {
    if (entry.habit_id !== habitId) continue
    const defs = byVersion.get(entry.habit_version)
    if (!defs) continue
    const values = fieldValuesOf(entry.field_values)
    for (const def of defs) {
      if (!CHOICE_TYPES.includes(def.field_type)) continue
      const value = textValue(values[def.field_key])
      const dist = result.get(def.field_key)
      if (value === null || !dist) continue
      dist.counts.set(value, (dist.counts.get(value) ?? 0) + 1)
      dist.total++
    }
  }

  return [...result.values()]
    .filter((d) => d.counts.size > 0)
    .map(({ counts, ...d }) => ({ ...d, options: [...counts].map(([option, count]) => ({ option, count })) }))
}

export type TextValues = {
  key: string
  habitId: string
  fieldKey: string
  label: string
  /** Newest first. */
  items: { date: ISODate; value: string }[]
}

export function textValuesForHabit(
  habitId: string,
  index: DefinitionIndex,
  entries: readonly ReportEntry[],
  limit = 10,
): TextValues[] {
  const byVersion = index.get(habitId)
  if (!byVersion) return []
  const result = new Map<string, TextValues & { labelVersion: number }>()
  const ordered = entries.filter((e) => e.habit_id === habitId).sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1))
  for (const entry of ordered) {
    const defs = byVersion.get(entry.habit_version)
    if (!defs) continue
    const values = fieldValuesOf(entry.field_values)
    for (const def of defs) {
      if (def.field_type !== 'text') continue
      const value = textValue(values[def.field_key])
      if (value === null) continue
      let t = result.get(def.field_key)
      if (!t) {
        t = { key: `${habitId}|${def.field_key}|text`, habitId, fieldKey: def.field_key, label: def.label, items: [], labelVersion: def.version }
        result.set(def.field_key, t)
      }
      if (def.version > t.labelVersion) {
        t.label = def.label
        t.labelVersion = def.version
      }
      if (t.items.length < limit) t.items.push({ date: entry.entry_date, value })
    }
  }
  return [...result.values()].map(({ labelVersion: _labelVersion, ...t }) => t)
}

// ---------------------------------------------------------------------------
// Weekly buckets
// ---------------------------------------------------------------------------

/** Calendar weeks overlapping the range, each clipped to the range. */
export function weeklyBuckets(range: DateRange, weekStartsOn: 0 | 1 = 1): DateRange[] {
  if (range.start > range.end) return []
  const buckets: DateRange[] = []
  let weekStart = toISODate(startOfWeek(parseISO(range.start), { weekStartsOn }))
  while (weekStart <= range.end) {
    const weekEnd = toISODate(addDays(parseISO(weekStart), 6))
    buckets.push({ start: weekStart < range.start ? range.start : weekStart, end: weekEnd > range.end ? range.end : weekEnd })
    weekStart = toISODate(addDays(parseISO(weekStart), 7))
  }
  return buckets
}

export type WeekSummary = DateRange & {
  completion: CompletionStats
  metrics: { series: NumericSeries; summary: NumericSummary | null }[]
}

export function weeklySummaries(
  days: readonly DayCompletion[],
  series: readonly NumericSeries[],
  range: DateRange,
  weekStartsOn: 0 | 1 = 1,
): WeekSummary[] {
  return weeklyBuckets(range, weekStartsOn).map((bucket) => ({
    ...bucket,
    completion: totalCompletion(days.filter((d) => d.date >= bucket.start && d.date <= bucket.end)),
    metrics: series.map((s) => ({ series: s, summary: summarizeInRange(s, bucket) })),
  }))
}

// ---------------------------------------------------------------------------
// Whole report
// ---------------------------------------------------------------------------

export type HabitReport<H extends ReportHabit = ReportHabit> = {
  habit: H
  completion: CompletionStats
  entryCount: number
  numeric: NumericSeries[]
  choices: ChoiceDistribution[]
  texts: TextValues[]
}

export type PersonalReport<H extends ReportHabit = ReportHabit> = {
  range: DateRange
  days: DayCompletion[]
  overall: CompletionStats
  /** Distinct days (up to today) with at least one entry. */
  daysTracked: number
  /** Days in the range up to today. */
  elapsedDays: number
  entriesRecorded: number
  habits: HabitReport<H>[]
}

/** Habits that belong in a report: active ones, plus archived ones that have entries in the range. */
export function habitsForReport<H extends ReportHabit>(habits: readonly H[], entries: readonly ReportEntry[], range: DateRange): H[] {
  const withEntries = new Set(
    entries.filter((e) => e.entry_date >= range.start && e.entry_date <= range.end).map((e) => e.habit_id),
  )
  return habits.filter((h) => {
    if (withEntries.has(h.id)) return true
    if (localDayOf(h.created_at) > range.end) return false
    return !h.archived_at || localDayOf(h.archived_at) >= range.start
  })
}

export function buildPersonalReport<H extends ReportHabit>(input: {
  habits: readonly H[]
  definitions: readonly ReportFieldDef[]
  entries: readonly ReportEntry[]
  range: DateRange
  today: ISODate
}): PersonalReport<H> {
  const { habits, definitions, range, today } = input
  const ids = new Set(habits.map((h) => h.id))
  const entries = input.entries.filter((e) => ids.has(e.habit_id) && e.entry_date >= range.start && e.entry_date <= range.end)
  const index = indexDefinitions(definitions)
  const days = completionByDay(habits, entries, range, today)
  const trackedDates = new Set(entries.filter((e) => e.entry_date <= today).map((e) => e.entry_date))
  const lastElapsed = range.end < today ? range.end : today
  return {
    range,
    days,
    overall: totalCompletion(days),
    daysTracked: trackedDates.size,
    elapsedDays: lastElapsed < range.start ? 0 : daysBetween(range.start, lastElapsed) + 1,
    entriesRecorded: entries.length,
    habits: habits.map((habit) => {
      const own = entries.filter((e) => e.habit_id === habit.id)
      return {
        habit,
        completion: totalCompletion(completionByDay([habit], own, range, today)),
        entryCount: own.length,
        numeric: numericSeriesForHabit(habit.id, index, own),
        choices: choiceDistributionsForHabit(habit.id, index, own),
        texts: textValuesForHabit(habit.id, index, own),
      }
    }),
  }
}

// ---------------------------------------------------------------------------
// Custom range validation
// ---------------------------------------------------------------------------

export const MAX_REPORT_DAYS = 366

/** Returns a friendly message when the custom range is not allowed, otherwise null. */
export function validateCustomRange(start: string, end: string, today: ISODate): string | null {
  const iso = /^\d{4}-\d{2}-\d{2}$/
  if (!iso.test(start) || Number.isNaN(parseISO(start).getTime())) return 'Choose a start date.'
  if (!iso.test(end) || Number.isNaN(parseISO(end).getTime())) return 'Choose an end date.'
  if (start > end) return 'The start date needs to be on or before the end date.'
  if (end > today) return 'Reports can only include days up to today.'
  if (daysBetween(start, end) + 1 > MAX_REPORT_DAYS) return `Pick a range of up to ${MAX_REPORT_DAYS} days.`
  return null
}

// ---------------------------------------------------------------------------
// Family leaderboard ranking (input is already limited to shared habits by the RPC)
// ---------------------------------------------------------------------------

export type LeaderboardInput = {
  userId: string
  sharedHabits: number
  scheduledDays: number
  completedDays: number
  /** 0–100, or null when nothing shared was scheduled. */
  consistency: number | null
  bestCurrentStreak: number
}

export type RankedMember<T extends LeaderboardInput> = {
  row: T
  /** 1-based rank (ties share a rank), or null when the member has nothing to rank. */
  rank: number | null
  /** Warm, never negative title. */
  title: string
}

export function warmTitle(row: LeaderboardInput): string {
  if (row.sharedHabits === 0) return 'No shared habits yet'
  if (row.consistency === null) return 'Nothing scheduled this period'
  if (row.consistency >= 90) return 'Steady star'
  if (row.bestCurrentStreak >= 3) return 'On a roll'
  if (row.consistency >= 60) return 'Building momentum'
  if (row.completedDays > 0) return 'Every step counts'
  return 'Fresh start ahead'
}

/**
 * Orders members by consistency (then completed days) with shared ranks for ties. Members without
 * shared habits or without scheduled days are listed afterwards without a rank.
 */
export function rankMembers<T extends LeaderboardInput>(rows: readonly T[]): RankedMember<T>[] {
  const rankable = rows
    .filter((r) => r.sharedHabits > 0 && r.consistency !== null)
    .sort((a, b) => (b.consistency ?? 0) - (a.consistency ?? 0) || b.completedDays - a.completedDays)
  const others = rows.filter((r) => !(r.sharedHabits > 0 && r.consistency !== null))
  const ranked: RankedMember<T>[] = []
  rankable.forEach((row, i) => {
    const prev = rankable[i - 1]
    const tied = prev && prev.consistency === row.consistency && prev.completedDays === row.completedDays
    ranked.push({ row, rank: tied ? ranked[i - 1]!.rank : i + 1, title: warmTitle(row) })
  })
  return [...ranked, ...others.map((row) => ({ row, rank: null, title: warmTitle(row) }))]
}
