import { describe, expect, it } from 'vitest'
import type { FieldDraft } from '@/types/models'
import { describeGoal, isEntryComplete, type GoalLike } from './completion'

const hours: FieldDraft = {
  field_key: 'hours',
  label: 'Hours slept',
  field_type: 'number',
  unit: 'h',
  options: [],
  required: true,
  validation: { min: 0, max: 24 },
}
const junk: FieldDraft = {
  field_key: 'had_junk_food',
  label: 'Did you eat junk food?',
  field_type: 'radio',
  options: ['No', 'Yes'],
  required: true,
  validation: {},
}
const subject: FieldDraft = {
  field_key: 'subject',
  label: 'Subject',
  field_type: 'dropdown',
  options: ['Maths', 'Science'],
  required: false,
  validation: {},
}

const noGoal: GoalLike = { goal_field_key: null, goal_operator: null, goal_value: null }
const goal = (key: string, op: 'gte' | 'lte' | 'eq', value: number | string): GoalLike => ({
  goal_field_key: key,
  goal_operator: op,
  goal_value: value,
})

describe('isEntryComplete', () => {
  it('without a goal: complete when all required fields are filled', () => {
    expect(isEntryComplete(noGoal, [hours, subject], { hours: 3 })).toBe(true)
    expect(isEntryComplete(noGoal, [hours, subject], { subject: 'Maths' })).toBe(false)
  })

  it('needs at least one value', () => {
    expect(isEntryComplete(noGoal, [subject], {})).toBe(false)
    expect(isEntryComplete(noGoal, [subject], { subject: '  ' })).toBe(false)
  })

  it('number goals: at least / at most / exactly', () => {
    expect(isEntryComplete(goal('hours', 'gte', 7), [hours], { hours: 7 })).toBe(true)
    expect(isEntryComplete(goal('hours', 'gte', 7), [hours], { hours: 6.5 })).toBe(false)
    expect(isEntryComplete(goal('hours', 'lte', 2), [hours], { hours: 1.5 })).toBe(true)
    expect(isEntryComplete(goal('hours', 'lte', 2), [hours], { hours: 3 })).toBe(false)
    expect(isEntryComplete(goal('hours', 'eq', 8), [hours], { hours: 8 })).toBe(true)
    expect(isEntryComplete(goal('hours', 'eq', 8), [hours], { hours: 8.25 })).toBe(false)
  })

  it('accepts numeric strings (raw form input)', () => {
    expect(isEntryComplete(goal('hours', 'gte', 7), [hours], { hours: '7.5' })).toBe(true)
  })

  it('choice goals compare with the option', () => {
    expect(isEntryComplete(goal('had_junk_food', 'eq', 'No'), [junk], { had_junk_food: 'No' })).toBe(true)
    expect(isEntryComplete(goal('had_junk_food', 'eq', 'No'), [junk], { had_junk_food: 'Yes' })).toBe(false)
  })

  it('is incomplete when the goal field was left empty', () => {
    expect(isEntryComplete(goal('subject', 'eq', 'Maths'), [hours, subject], { hours: 2 })).toBe(false)
  })

  it('ignores a goal on a field this version does not have', () => {
    expect(isEntryComplete(goal('pages', 'gte', 10), [hours], { hours: 1 })).toBe(true)
  })
})

describe('describeGoal', () => {
  it('describes number goals with units', () => {
    expect(describeGoal(goal('hours', 'gte', 7), [hours])).toBe('Hours slept: at least 7 h')
    expect(describeGoal(goal('hours', 'lte', 0.5), [hours])).toBe('Hours slept: at most 0.5 h')
  })

  it('describes choice goals without doubled punctuation', () => {
    expect(describeGoal(goal('had_junk_food', 'eq', 'No'), [junk])).toBe('Did you eat junk food? No')
    expect(describeGoal(goal('subject', 'eq', 'Maths'), [subject])).toBe('Subject: Maths')
  })

  it('returns null without a goal', () => {
    expect(describeGoal(noGoal, [hours])).toBeNull()
  })
})
