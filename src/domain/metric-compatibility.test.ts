import { describe, expect, it } from 'vitest'
import {
  aggregateValue, allowedAggregations, defaultAggregation, groupComparableMetrics, metricKey, type MetricSeriesRow,
} from './metric-compatibility'

function row(over: Partial<MetricSeriesRow>): MetricSeriesRow {
  return {
    user_id: 'u1',
    habit_id: 'h1',
    habit_name: 'Walking',
    template_key: null,
    field_key: 'steps',
    field_label: 'Steps',
    unit: 'steps',
    entry_date: '2026-11-02',
    value: 1000,
    is_complete: true,
    ...over,
  }
}

describe('metricKey', () => {
  it('matches custom habits by normalized name, field label and unit', () => {
    expect(metricKey(row({ habit_name: '  walking ', field_label: 'STEPS', unit: ' Steps ' }))).toBe(metricKey(row({})))
  })

  it('matches template habits by template and field key regardless of name', () => {
    const a = metricKey(row({ template_key: 'walk', habit_name: 'Morning walk', field_key: 'steps', field_label: 'Steps' }))
    const b = metricKey(row({ template_key: 'WALK', habit_name: 'Walkies', field_key: 'steps', field_label: 'Step count' }))
    expect(a).toBe(b)
  })

  it('treats different units as different metrics', () => {
    expect(metricKey(row({ unit: 'km' }))).not.toBe(metricKey(row({ unit: 'miles' })))
    expect(metricKey(row({ unit: null }))).not.toBe(metricKey(row({ unit: 'steps' })))
  })

  it('returns null when nothing identifies the habit', () => {
    expect(metricKey(row({ habit_name: ' ', template_key: null }))).toBeNull()
  })
})

describe('groupComparableMetrics', () => {
  it('groups members into comparable metrics and builds labels', () => {
    const metrics = groupComparableMetrics([
      row({ user_id: 'u1', entry_date: '2026-11-02', value: 4000 }),
      row({ user_id: 'u1', entry_date: '2026-11-03', value: 6000 }),
      row({ user_id: 'u2', habit_id: 'h2', habit_name: 'walking', entry_date: '2026-11-03', value: 8000 }),
      row({ user_id: 'u2', habit_id: 'h3', habit_name: 'Sleep', field_key: 'hours', field_label: 'Hours', unit: 'hours', value: 7.5 }),
    ])
    expect(metrics).toHaveLength(2)
    const walking = metrics[0]!
    expect(walking.label).toBe('Walking · steps')
    expect(walking.dates).toEqual(['2026-11-02', '2026-11-03'])
    expect(walking.members.map((m) => [m.userId, m.summary.total, m.summary.average])).toEqual([
      ['u1', 10000, 5000],
      ['u2', 8000, 8000],
    ])
    expect(metrics[1]!.label).toBe('Sleep · hours')
    expect(metrics[1]!.members[0]!.summary.total).toBe(7.5)
  })

  it('never merges values with different units', () => {
    const metrics = groupComparableMetrics([
      row({ user_id: 'u1', unit: 'km', field_label: 'Distance', value: 3.5 }),
      row({ user_id: 'u2', unit: 'miles', field_label: 'Distance', value: 2 }),
    ])
    expect(metrics).toHaveLength(2)
    expect(metrics.map((m) => m.label).sort()).toEqual(['Walking · km', 'Walking · miles'])
    expect(metrics.every((m) => m.members.length === 1)).toBe(true)
  })

  it('disambiguates two fields that share a unit', () => {
    const metrics = groupComparableMetrics([
      row({ habit_name: 'Water', field_key: 'am', field_label: 'Morning', unit: 'ml', value: 250 }),
      row({ habit_name: 'Water', field_key: 'pm', field_label: 'Evening', unit: 'ml', value: 500 }),
    ])
    expect(metrics.map((m) => m.label).sort()).toEqual(['Water · Evening (ml)', 'Water · Morning (ml)'])
  })

  it('adds values of the same metric from two habits of one member on the same day', () => {
    const [metric] = groupComparableMetrics([
      row({ habit_id: 'a', value: 0.1 }),
      row({ habit_id: 'b', value: 0.2 }),
    ])
    expect(metric!.members[0]!.values).toEqual([{ date: '2026-11-02', value: 0.3 }])
  })

  it('skips incomplete rows', () => {
    expect(groupComparableMetrics([row({ value: null }), row({ user_id: null }), row({ entry_date: null })])).toEqual([])
  })
})

describe('aggregation rules', () => {
  it('sums additive units and averages level-like units', () => {
    expect(defaultAggregation('Steps')).toBe('total')
    expect(defaultAggregation('litres')).toBe('total')
    expect(defaultAggregation('hours')).toBe('total')
    expect(defaultAggregation('kg')).toBe('average')
    expect(allowedAggregations('kg')).toEqual(['average'])
    expect(allowedAggregations('steps')).toEqual(['total', 'average'])
    expect(defaultAggregation(null)).toBe('average')
  })

  it('reads the right value from a summary', () => {
    const summary = { count: 2, total: 10, average: 5, min: 4, max: 6 }
    expect(aggregateValue(summary, 'total')).toBe(10)
    expect(aggregateValue(summary, 'average')).toBe(5)
  })
})
