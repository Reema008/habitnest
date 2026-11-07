import { describe, expect, it } from 'vitest'
import type { FieldDefinition, HabitWithFields } from '@/types/models'
import {
  challengeLengthDays, challengeStatus, combinedProgress, daysElapsed, daysRemaining, daysUntilStart, describeMetric,
  eligibleHabitFields, formatAmount, formatProgress, optionKey, orderProgress, percentOf, reachedCount, timingLabel,
  unitsMatch, validateChallengeDraft, type ChallengeDraft,
} from './challenge'

const week = { start_date: '2026-11-10', end_date: '2026-11-16' }

function field(habitId: string, overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return {
    id: `${habitId}-${overrides.field_key ?? 'value'}-${overrides.version ?? 1}`,
    habit_id: habitId,
    version: 1,
    field_key: 'value',
    label: 'Value',
    field_type: 'number',
    unit: null,
    options: [],
    required: true,
    validation: {},
    sort_order: 0,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
    ...overrides,
  }
}

function habit(id: string, overrides: Partial<HabitWithFields> = {}): HabitWithFields {
  return {
    id,
    owner_id: 'me',
    name: id,
    description: null,
    icon: 'sparkles',
    color: 'lavender',
    template_key: null,
    visibility: 'family',
    notes_enabled: false,
    current_version: 1,
    frequency_days: [0, 1, 2, 3, 4, 5, 6],
    goal_field_key: null,
    goal_operator: null,
    goal_value: null,
    sort_order: 0,
    archived_at: null,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
    fields: [],
    ...overrides,
  }
}

describe('challengeStatus', () => {
  it('is upcoming before the start date', () => {
    expect(challengeStatus(week, '2026-11-09')).toBe('upcoming')
  })
  it('is active on the first and last day', () => {
    expect(challengeStatus(week, '2026-11-10')).toBe('active')
    expect(challengeStatus(week, '2026-11-16')).toBe('active')
  })
  it('is finished after the end date', () => {
    expect(challengeStatus(week, '2026-11-17')).toBe('finished')
  })
})

describe('day counting', () => {
  it('counts the length inclusively', () => {
    expect(challengeLengthDays(week)).toBe(7)
    expect(challengeLengthDays({ start_date: '2026-11-10', end_date: '2026-11-10' })).toBe(1)
  })
  it('counts remaining days including today', () => {
    expect(daysRemaining(week, '2026-11-10')).toBe(7)
    expect(daysRemaining(week, '2026-11-16')).toBe(1)
    expect(daysRemaining(week, '2026-11-01')).toBe(7)
    expect(daysRemaining(week, '2026-11-20')).toBe(0)
  })
  it('counts elapsed days including today', () => {
    expect(daysElapsed(week, '2026-11-01')).toBe(0)
    expect(daysElapsed(week, '2026-11-12')).toBe(3)
    expect(daysElapsed(week, '2026-12-01')).toBe(7)
  })
  it('counts days until start', () => {
    expect(daysUntilStart(week, '2026-11-08')).toBe(2)
    expect(daysUntilStart(week, '2026-11-12')).toBe(0)
  })
  it('handles month and year boundaries', () => {
    const c = { start_date: '2026-12-30', end_date: '2027-01-02' }
    expect(challengeLengthDays(c)).toBe(4)
    expect(daysRemaining(c, '2026-12-31')).toBe(3)
  })
  it('produces friendly timing labels', () => {
    expect(timingLabel(week, '2026-11-09')).toBe('Starts tomorrow')
    expect(timingLabel(week, '2026-11-07')).toBe('Starts in 3 days')
    expect(timingLabel(week, '2026-11-14')).toBe('3 days left')
    expect(timingLabel(week, '2026-11-16')).toBe('Last day today')
    expect(timingLabel(week, '2026-11-17')).toBe('Finished')
  })
})

describe('unitsMatch', () => {
  it('compares case-insensitively like the database', () => {
    expect(unitsMatch('Steps', 'steps')).toBe(true)
    expect(unitsMatch('L', 'l')).toBe(true)
    expect(unitsMatch(null, '')).toBe(true)
    expect(unitsMatch('km', 'steps')).toBe(false)
    expect(unitsMatch(null, 'steps')).toBe(false)
  })
})

describe('eligibleHabitFields', () => {
  const walking = habit('walk', {
    current_version: 2,
    fields: [
      field('walk', { field_key: 'steps', unit: 'Steps', version: 2 }),
      field('walk', { field_key: 'km', unit: 'km', version: 2 }),
      field('walk', { field_key: 'mood', field_type: 'radio', unit: null, version: 2 }),
    ],
  })
  const oldVersionOnly = habit('old', {
    current_version: 2,
    fields: [field('old', { field_key: 'steps', unit: 'steps', version: 1 })],
  })
  const privateHabit = habit('private', { visibility: 'private', fields: [field('private', { unit: 'steps' })] })
  const archived = habit('archived', { archived_at: '2026-11-01T00:00:00Z', fields: [field('archived', { unit: 'steps' })] })
  const textUnit = habit('text', { fields: [field('text', { field_type: 'text', unit: 'steps' })] })

  it('offers number fields with a matching unit from shared habits only (sum)', () => {
    const result = eligibleHabitFields({ aggregation: 'sum', unit: 'steps' }, [walking, oldVersionOnly, privateHabit, archived, textUnit])
    expect(result.map((o) => optionKey(o.habit.id, o.field?.field_key))).toEqual(['walk::steps'])
  })

  it('offers every shared, active habit for days completed', () => {
    const result = eligibleHabitFields({ aggregation: 'days_met', unit: null }, [walking, privateHabit, archived, textUnit])
    expect(result.map((o) => o.habit.id)).toEqual(['walk', 'text'])
    expect(result.every((o) => o.field === null)).toBe(true)
  })

  it('returns nothing when no habit fits', () => {
    expect(eligibleHabitFields({ aggregation: 'sum', unit: 'L' }, [walking])).toEqual([])
  })
})

describe('formatting', () => {
  const sum = { aggregation: 'sum' as const, unit: 'steps' }
  const days = { aggregation: 'days_met' as const, unit: null }

  it('formats amounts with units', () => {
    expect(formatAmount(sum, 12500, 'en-US')).toBe('12,500 steps')
    expect(formatAmount({ aggregation: 'sum', unit: 'L' }, 2.456, 'en-US')).toBe('2.46 L')
    expect(formatAmount(days, 1, 'en-US')).toBe('1 day')
    expect(formatAmount(days, 4, 'en-US')).toBe('4 days')
  })

  it('formats progress against the target', () => {
    expect(formatProgress(sum, 1250, 10000, 'en-US')).toBe('1,250 / 10,000 steps')
    expect(formatProgress(days, 3, 20, 'en-US')).toBe('3 / 20 days')
  })

  it('clamps percentages', () => {
    expect(percentOf(50, 200)).toBe(25)
    expect(percentOf(500, 200)).toBe(100)
    expect(percentOf(-5, 200)).toBe(0)
    expect(percentOf(5, 0)).toBe(0)
  })

  it('describes the metric', () => {
    expect(describeMetric({ aggregation: 'sum', unit: 'steps', metric_label: 'Walking' })).toBe('Total walking (steps)')
    expect(describeMetric({ aggregation: 'days_met', unit: null, metric_label: 'Days completed' })).toMatch(/completed/)
  })
})

describe('validateChallengeDraft', () => {
  const base: ChallengeDraft = {
    title: 'Step it up',
    description: '',
    aggregation: 'sum',
    metricLabel: 'Walking',
    unit: 'steps',
    target: 50000,
    startDate: '2026-11-10',
    endDate: '2026-11-16',
  }

  it('accepts a valid draft', () => {
    expect(validateChallengeDraft(base)).toEqual({})
  })

  it('requires a title, metric and unit for sums', () => {
    const errors = validateChallengeDraft({ ...base, title: '  ', metricLabel: '', unit: ' ' })
    expect(errors.title).toBeDefined()
    expect(errors.metricLabel).toBeDefined()
    expect(errors.unit).toBeDefined()
  })

  it('does not need a unit for days completed', () => {
    expect(validateChallengeDraft({ ...base, aggregation: 'days_met', metricLabel: '', unit: '', target: 5 })).toEqual({})
  })

  it('requires a positive target', () => {
    expect(validateChallengeDraft({ ...base, target: 0 }).target).toBeDefined()
    expect(validateChallengeDraft({ ...base, target: Number.NaN }).target).toBeDefined()
  })

  it('limits days-completed targets to whole days within the challenge', () => {
    expect(validateChallengeDraft({ ...base, aggregation: 'days_met', target: 8 }).target).toBeDefined()
    expect(validateChallengeDraft({ ...base, aggregation: 'days_met', target: 2.5 }).target).toBeDefined()
    expect(validateChallengeDraft({ ...base, aggregation: 'days_met', target: 7 }).target).toBeUndefined()
  })

  it('checks date order and maximum length', () => {
    expect(validateChallengeDraft({ ...base, endDate: '2026-11-09' }).endDate).toBeDefined()
    expect(validateChallengeDraft({ ...base, endDate: '2027-11-11' }).endDate).toBeUndefined()
    expect(validateChallengeDraft({ ...base, endDate: '2027-11-12' }).endDate).toBeDefined()
    expect(validateChallengeDraft({ ...base, startDate: '' }).startDate).toBeDefined()
  })
})

describe('results helpers', () => {
  const rows = [
    { userId: 'a', displayName: 'Zoe', progress: 10, target: 20, percent: 50 },
    { userId: 'b', displayName: 'Adam', progress: 20, target: 20, percent: 100 },
    { userId: 'c', displayName: 'Bea', progress: 10, target: 20, percent: 50 },
  ]
  it('orders gently by percent then name without dropping anyone', () => {
    expect(orderProgress(rows).map((r) => r.displayName)).toEqual(['Adam', 'Bea', 'Zoe'])
  })
  it('adds up everyone’s progress', () => {
    expect(combinedProgress(rows)).toBe(40)
  })
  it('counts who reached the target', () => {
    expect(reachedCount(rows)).toBe(1)
  })
})
