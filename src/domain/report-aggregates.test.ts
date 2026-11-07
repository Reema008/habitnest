import { describe, expect, it } from 'vitest'
import {
  buildPersonalReport, choiceDistributionsForHabit, completionByDay, completionForHabit, dailyValues, habitsForReport,
  indexDefinitions, isScheduledDay, normalizeUnit, numericSeriesForHabit, numericValue, summarize, textValuesForHabit,
  rankMembers, totalCompletion, validateCustomRange, warmTitle, weeklyBuckets, weeklySummaries,
  type ReportEntry, type ReportFieldDef, type ReportHabit,
} from './report-aggregates'
import type { Json } from '@/types/models'

// 2026-11-02 is a Monday.
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

function habit(over: Partial<ReportHabit> = {}): ReportHabit {
  return {
    id: 'h1',
    name: 'Sleep',
    frequency_days: ALL_DAYS,
    // Midday local time so the local calendar day is stable in any test time zone.
    created_at: new Date(2026, 0, 1, 12).toISOString(),
    archived_at: null,
    ...over,
  }
}

function def(over: Partial<ReportFieldDef> & Pick<ReportFieldDef, 'field_key'>): ReportFieldDef {
  return {
    habit_id: 'h1',
    version: 1,
    label: over.field_key,
    field_type: 'number',
    unit: null,
    options: [],
    sort_order: 0,
    ...over,
  }
}

function entry(date: string, values: Record<string, Json>, over: Partial<ReportEntry> = {}): ReportEntry {
  return { habit_id: 'h1', entry_date: date, habit_version: 1, field_values: values, is_complete: true, ...over }
}

describe('helpers', () => {
  it('normalizes units case-insensitively and trimmed', () => {
    expect(normalizeUnit('  Hours ')).toBe('hours')
    expect(normalizeUnit('fl  oz')).toBe('fl oz')
    expect(normalizeUnit(null)).toBe('')
  })

  it('reads numeric values from numbers and numeric strings only', () => {
    expect(numericValue(7.5)).toBe(7.5)
    expect(numericValue('7.5')).toBe(7.5)
    expect(numericValue('')).toBeNull()
    expect(numericValue('lots')).toBeNull()
    expect(numericValue(null)).toBeNull()
    expect(numericValue(undefined)).toBeNull()
  })

  it('summarizes decimals without floating point noise', () => {
    const s = summarize([7.5, 6.25, 8.1, 0.1, 0.2])!
    expect(s.count).toBe(5)
    expect(s.total).toBe(22.15)
    expect(s.average).toBe(4.43)
    expect(s.min).toBe(0.1)
    expect(s.max).toBe(8.1)
    expect(summarize([0.1, 0.2])!.total).toBe(0.3)
    expect(summarize([])).toBeNull()
  })
})

describe('scheduling & completion', () => {
  it('only counts scheduled weekdays', () => {
    const weekdays = habit({ frequency_days: [1, 3, 5] }) // Mon, Wed, Fri
    const days = completionByDay([weekdays], [entry('2026-11-02', {}), entry('2026-11-03', {})], { start: '2026-11-02', end: '2026-11-08' }, '2026-11-08')
    expect(days.map((d) => d.scheduled)).toEqual([1, 0, 1, 0, 1, 0, 0])
    const total = totalCompletion(days)
    expect(total).toMatchObject({ scheduled: 3, completed: 1, bonus: 1 })
    expect(total.percent).toBeCloseTo(33.333, 2)
  })

  it('ignores days before the habit existed and after today', () => {
    const h = habit({ created_at: new Date(2026, 10, 4, 9).toISOString() }) // Wed 4 Nov
    const stats = completionForHabit(h, [entry('2026-11-04', {}), entry('2026-11-05', {}, { is_complete: false })], { start: '2026-11-02', end: '2026-11-08' }, '2026-11-06')
    // 4, 5, 6 Nov are scheduled; 2–3 (before creation) and 7–8 (future) are not.
    expect(stats.scheduled).toBe(3)
    expect(stats.completed).toBe(1)
    expect(stats.percent).toBeCloseTo(33.33, 1)
  })

  it('stops scheduling after a habit was archived, and only counts the archive day if done', () => {
    const h = habit({ archived_at: new Date(2026, 10, 5, 18).toISOString() }) // Thu 5 Nov
    expect(isScheduledDay(h, '2026-11-04', '2026-11-08', false)).toBe(true)
    expect(isScheduledDay(h, '2026-11-05', '2026-11-08', false)).toBe(false)
    expect(isScheduledDay(h, '2026-11-05', '2026-11-08', true)).toBe(true)
    expect(isScheduledDay(h, '2026-11-06', '2026-11-08', true)).toBe(false)
  })

  it('returns null percentages when nothing was scheduled', () => {
    const days = completionByDay([habit({ frequency_days: [6] })], [], { start: '2026-11-02', end: '2026-11-06' }, '2026-11-08')
    expect(days.every((d) => d.ratio === null)).toBe(true)
    expect(totalCompletion(days).percent).toBeNull()
  })

  it('computes per-day ratios across several habits', () => {
    const a = habit({ id: 'a' })
    const b = habit({ id: 'b', frequency_days: [1] })
    const days = completionByDay([a, b], [entry('2026-11-02', {}, { habit_id: 'a' })], { start: '2026-11-02', end: '2026-11-03' }, '2026-11-08')
    expect(days[0]).toMatchObject({ scheduled: 2, completed: 1, ratio: 0.5 })
    expect(days[1]).toMatchObject({ scheduled: 1, completed: 0, ratio: 0 })
  })

  it('marks future days', () => {
    const days = completionByDay([habit()], [], { start: '2026-11-07', end: '2026-11-09' }, '2026-11-08')
    expect(days.map((d) => d.isFuture)).toEqual([false, false, true])
    expect(days[2]!.scheduled).toBe(0)
  })
})

describe('numeric series', () => {
  it('keeps one series per field_key + unit and never merges different units', () => {
    const index = indexDefinitions([
      def({ field_key: 'sleep', label: 'Sleep', unit: 'hours', version: 1 }),
      def({ field_key: 'sleep', label: 'Sleep', unit: 'minutes', version: 2 }),
      def({ field_key: 'sleep', label: 'Sleep time', unit: ' Hours ', version: 3 }),
    ])
    const series = numericSeriesForHabit('h1', index, [
      entry('2026-11-02', { sleep: 7.5 }, { habit_version: 1 }),
      entry('2026-11-03', { sleep: 420 }, { habit_version: 2 }),
      entry('2026-11-04', { sleep: '8' }, { habit_version: 3 }),
    ])
    expect(series).toHaveLength(2)
    const hours = series.find((s) => s.unit === 'Hours')!
    const minutes = series.find((s) => s.unit === 'minutes')!
    expect(hours.points).toEqual([{ date: '2026-11-02', value: 7.5 }, { date: '2026-11-04', value: 8 }])
    expect(hours.label).toBe('Sleep time') // newest label wins
    expect(hours.versions).toEqual([1, 3])
    expect(hours.summary).toMatchObject({ total: 15.5, average: 7.75, min: 7.5, max: 8, count: 2 })
    expect(minutes.points).toEqual([{ date: '2026-11-03', value: 420 }])
    expect(minutes.summary!.total).toBe(420)
  })

  it('never combines different field keys even with the same unit', () => {
    const index = indexDefinitions([
      def({ field_key: 'morning', unit: 'ml' }),
      def({ field_key: 'evening', unit: 'ml', sort_order: 1 }),
    ])
    const series = numericSeriesForHabit('h1', index, [entry('2026-11-02', { morning: 250, evening: 500 })])
    expect(series.map((s) => [s.fieldKey, s.summary!.total])).toEqual([['morning', 250], ['evening', 500]])
  })

  it('interprets each entry with the definitions of its own version', () => {
    const index = indexDefinitions([
      def({ field_key: 'value', field_type: 'number', unit: 'km', version: 1 }),
      def({ field_key: 'value', field_type: 'text', version: 2 }),
    ])
    const entries = [
      entry('2026-11-02', { value: 5 }, { habit_version: 1 }),
      entry('2026-11-03', { value: '12' }, { habit_version: 2 }), // text in v2 — not a number
    ]
    const series = numericSeriesForHabit('h1', index, entries)
    expect(series).toHaveLength(1)
    expect(series[0]!.points).toEqual([{ date: '2026-11-02', value: 5 }])
    expect(textValuesForHabit('h1', index, entries)[0]!.items).toEqual([{ date: '2026-11-03', value: '12' }])
  })

  it('skips entries whose version has no definitions and missing values', () => {
    const index = indexDefinitions([def({ field_key: 'steps', unit: 'steps' })])
    const series = numericSeriesForHabit('h1', index, [
      entry('2026-11-02', { steps: 1000 }),
      entry('2026-11-03', {}),
      entry('2026-11-04', { steps: 3000 }, { habit_version: 9 }),
    ])
    expect(series[0]!.points).toEqual([{ date: '2026-11-02', value: 1000 }])
  })

  it('fills missing days with null rather than zero', () => {
    const index = indexDefinitions([def({ field_key: 'steps', unit: 'steps' })])
    const [series] = numericSeriesForHabit('h1', index, [entry('2026-11-02', { steps: 1000 }), entry('2026-11-04', { steps: 3000 })])
    expect(dailyValues(series!, { start: '2026-11-01', end: '2026-11-04' })).toEqual([
      { date: '2026-11-01', value: null },
      { date: '2026-11-02', value: 1000 },
      { date: '2026-11-03', value: null },
      { date: '2026-11-04', value: 3000 },
    ])
    expect(series!.summary!.average).toBe(2000) // per recorded day, not per calendar day
  })
})

describe('choices and text', () => {
  it('counts choices including zero-count current options and older options', () => {
    const index = indexDefinitions([
      def({ field_key: 'mood', field_type: 'radio', options: ['Happy', 'Meh'], version: 1 }),
      def({ field_key: 'mood', field_type: 'radio', label: 'How I felt', options: ['Great', 'Happy', 'Tired'], version: 2 }),
    ])
    const [dist] = choiceDistributionsForHabit('h1', index, [
      entry('2026-11-02', { mood: 'Meh' }, { habit_version: 1 }),
      entry('2026-11-03', { mood: 'Happy' }, { habit_version: 2 }),
      entry('2026-11-04', { mood: 'Happy' }, { habit_version: 2 }),
    ])
    expect(dist!.label).toBe('How I felt')
    expect(dist!.total).toBe(3)
    expect(dist!.options).toEqual([
      { option: 'Great', count: 0 },
      { option: 'Happy', count: 2 },
      { option: 'Tired', count: 0 },
      { option: 'Meh', count: 1 },
    ])
  })

  it('lists recent text values newest first with a limit', () => {
    const index = indexDefinitions([def({ field_key: 'note', field_type: 'text' })])
    const entries = ['2026-11-01', '2026-11-02', '2026-11-03'].map((d) => entry(d, { note: `on ${d}` }))
    const [text] = textValuesForHabit('h1', index, [...entries, entry('2026-11-04', { note: '   ' })], 2)
    expect(text!.items.map((i) => i.date)).toEqual(['2026-11-03', '2026-11-02'])
  })
})

describe('weekly buckets', () => {
  it('splits a month into Monday-based weeks clipped to the range', () => {
    expect(weeklyBuckets({ start: '2026-11-01', end: '2026-11-30' })).toEqual([
      { start: '2026-11-01', end: '2026-11-01' },
      { start: '2026-11-02', end: '2026-11-08' },
      { start: '2026-11-09', end: '2026-11-15' },
      { start: '2026-11-16', end: '2026-11-22' },
      { start: '2026-11-23', end: '2026-11-29' },
      { start: '2026-11-30', end: '2026-11-30' },
    ])
  })

  it('summarizes completion and per-series averages per week', () => {
    const h = habit({ frequency_days: ALL_DAYS })
    const index = indexDefinitions([def({ field_key: 'sleep', unit: 'h' })])
    const entries = [
      entry('2026-11-02', { sleep: 7.5 }),
      entry('2026-11-03', { sleep: 6.5 }),
      entry('2026-11-09', { sleep: 8 }, { is_complete: false }),
    ]
    const range = { start: '2026-11-02', end: '2026-11-15' }
    const days = completionByDay([h], entries, range, '2026-11-15')
    const series = numericSeriesForHabit('h1', index, entries)
    const weeks = weeklySummaries(days, series, range)
    expect(weeks).toHaveLength(2)
    expect(weeks[0]!.completion).toMatchObject({ scheduled: 7, completed: 2 })
    expect(weeks[0]!.metrics[0]!.summary).toMatchObject({ average: 7, total: 14 })
    expect(weeks[1]!.completion).toMatchObject({ scheduled: 7, completed: 0, percent: 0 })
    expect(weeks[1]!.metrics[0]!.summary).toMatchObject({ average: 8, count: 1 })
  })
})

describe('buildPersonalReport', () => {
  it('builds totals over the selected habits only', () => {
    const a = habit({ id: 'a', name: 'Walk' })
    const b = habit({ id: 'b', name: 'Read', frequency_days: [1, 2, 3, 4, 5] })
    const report = buildPersonalReport({
      habits: [a, b],
      definitions: [def({ habit_id: 'a', field_key: 'steps', unit: 'steps' })],
      entries: [
        entry('2026-11-02', { steps: 4000 }, { habit_id: 'a' }),
        entry('2026-11-02', {}, { habit_id: 'b' }),
        entry('2026-11-03', {}, { habit_id: 'other' }),
      ],
      range: { start: '2026-11-02', end: '2026-11-08' },
      today: '2026-11-04',
    })
    // a: 2,3,4 scheduled (3) — b: 2,3,4 (3) → 6 scheduled, 2 completed
    expect(report.overall).toMatchObject({ scheduled: 6, completed: 2 })
    expect(report.entriesRecorded).toBe(2)
    expect(report.daysTracked).toBe(1)
    expect(report.elapsedDays).toBe(3)
    expect(report.habits[0]!.numeric[0]!.summary!.total).toBe(4000)
    expect(report.habits[1]!.completion).toMatchObject({ scheduled: 3, completed: 1 })
  })

  it('includes archived habits only when they have entries or overlap the range', () => {
    const active = habit({ id: 'active' })
    const archivedLongAgo = habit({ id: 'old', archived_at: new Date(2026, 5, 1, 12).toISOString() })
    const archivedWithEntries = habit({ id: 'logged', archived_at: new Date(2026, 5, 1, 12).toISOString() })
    const future = habit({ id: 'future', created_at: new Date(2026, 11, 20, 12).toISOString() })
    const result = habitsForReport(
      [active, archivedLongAgo, archivedWithEntries, future],
      [entry('2026-11-03', {}, { habit_id: 'logged' })],
      { start: '2026-11-01', end: '2026-11-30' },
    )
    expect(result.map((h) => h.id)).toEqual(['active', 'logged'])
  })
})

describe('validateCustomRange', () => {
  it('accepts valid ranges and explains invalid ones', () => {
    expect(validateCustomRange('2026-11-01', '2026-11-08', '2026-11-08')).toBeNull()
    expect(validateCustomRange('2026-11-09', '2026-11-08', '2026-11-08')).toMatch(/on or before/)
    expect(validateCustomRange('2026-11-01', '2026-11-09', '2026-11-08')).toMatch(/up to today/)
    expect(validateCustomRange('2025-11-07', '2026-11-08', '2026-11-08')).toMatch(/366/)
    expect(validateCustomRange('2025-11-08', '2026-11-08', '2026-11-08')).toBeNull() // exactly 366 days
    expect(validateCustomRange('', '2026-11-08', '2026-11-08')).toMatch(/start/)
  })
})

describe('rankMembers', () => {
  const base = { sharedHabits: 2, scheduledDays: 10, completedDays: 5, consistency: 50, bestCurrentStreak: 0 }

  it('ranks by consistency with shared ranks for ties and leaves unrankable members unranked', () => {
    const ranked = rankMembers([
      { ...base, userId: 'a', consistency: 50, completedDays: 5 },
      { ...base, userId: 'b', consistency: 95, completedDays: 19, scheduledDays: 20 },
      { ...base, userId: 'c', sharedHabits: 0, scheduledDays: 0, completedDays: 0, consistency: null },
      { ...base, userId: 'd', consistency: 50, completedDays: 5 },
      { ...base, userId: 'e', consistency: null, scheduledDays: 0, completedDays: 0 },
    ])
    expect(ranked.map((r) => [r.row.userId, r.rank])).toEqual([
      ['b', 1], ['a', 2], ['d', 2], ['c', null], ['e', null],
    ])
    expect(ranked.find((r) => r.row.userId === 'c')!.title).toBe('No shared habits yet')
    expect(ranked.find((r) => r.row.userId === 'b')!.title).toBe('Steady star')
  })

  it('only uses warm titles', () => {
    expect(warmTitle({ ...base, userId: 'x', consistency: 0, completedDays: 0 })).toBe('Fresh start ahead')
    expect(warmTitle({ ...base, userId: 'x', consistency: 30, completedDays: 3 })).toBe('Every step counts')
    expect(warmTitle({ ...base, userId: 'x', consistency: 40, bestCurrentStreak: 4 })).toBe('On a roll')
    expect(warmTitle({ ...base, userId: 'x', consistency: 70 })).toBe('Building momentum')
  })
})
