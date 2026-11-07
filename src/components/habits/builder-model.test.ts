import { describe, expect, it } from 'vitest'
import type { FieldDefinition, HabitWithFields } from '@/types/models'
import {
  builderFromHabit, changeFieldType, emptyBuilder, emptyField, reconcileGoal, toFieldDrafts, toGoalDraft, toHabitMeta,
  validateBuilder, withFieldKeys, type BuilderField, type BuilderState,
} from './builder-model'

function field(p: Partial<BuilderField>): BuilderField {
  return { ...emptyField(p.field_type ?? 'number'), ...p }
}

function readingHabit(): BuilderState {
  const s = emptyBuilder()
  const fields = withFieldKeys([
    field({ label: 'Hours read', field_type: 'number', unit: 'h', min: '0', max: '24' }),
    field({ label: 'Type of book', field_type: 'dropdown', options: ['Fiction', 'Non-fiction', 'Comic'], required: false }),
    field({ label: 'Notes', field_type: 'text', required: false, min: '' }),
  ])
  return { ...s, name: 'Reading', fields, goal: { fieldUid: fields[0]!.uid, operator: 'gte', value: '0.5' } }
}

describe('builder model', () => {
  it('builds the "Reading" example', () => {
    const s = readingHabit()
    expect(validateBuilder(s)).toEqual({})
    expect(toFieldDrafts(s)).toEqual([
      { field_key: 'hours_read', label: 'Hours read', field_type: 'number', unit: 'h', options: [], required: true, validation: { min: 0, max: 24 } },
      { field_key: 'type_of_book', label: 'Type of book', field_type: 'dropdown', unit: null, options: ['Fiction', 'Non-fiction', 'Comic'], required: false, validation: {} },
      { field_key: 'notes', label: 'Notes', field_type: 'text', unit: null, options: [], required: false, validation: {} },
    ])
    expect(toGoalDraft(s)).toEqual({ field_key: 'hours_read', operator: 'gte', value: 0.5 })
    expect(toHabitMeta(s)).toMatchObject({ name: 'Reading', visibility: 'private', frequency_days: [0, 1, 2, 3, 4, 5, 6] })
  })

  it('builds the "Daily Study" example with a radio goal', () => {
    const fields = withFieldKeys([
      field({ label: 'Study hours', unit: 'h' }),
      field({ label: 'Subject', field_type: 'dropdown', options: ['Maths', 'Science'] }),
      field({ label: 'Status', field_type: 'radio', options: ['Completed', 'Not completed'] }),
    ])
    const s: BuilderState = { ...emptyBuilder(), name: 'Daily Study', fields, goal: { fieldUid: fields[2]!.uid, operator: 'eq', value: 'Completed' } }
    expect(validateBuilder(s)).toEqual({})
    expect(toGoalDraft(s)).toEqual({ field_key: 'status', operator: 'eq', value: 'Completed' })
  })

  it('validates name, days, options and min/max', () => {
    const s = readingHabit()
    const bad: BuilderState = {
      ...s,
      name: ' ',
      frequencyDays: [],
      fields: [
        { ...s.fields[0]!, min: '10', max: '5' },
        { ...s.fields[1]!, options: ['Fiction', 'fiction', ''] },
        s.fields[2]!,
      ],
    }
    const errors = validateBuilder(bad)
    expect(errors.name).toBeDefined()
    expect(errors.frequency).toBeDefined()
    expect(errors[`field.${s.fields[0]!.uid}.max`]).toBeDefined()
    expect(errors[`field.${s.fields[1]!.uid}.option.1`]).toBe('Options must be unique')
    expect(errors[`field.${s.fields[1]!.uid}.option.2`]).toBeDefined()
  })

  it('keeps existing keys stable when labels are renamed', () => {
    const habit = {
      goal_field_key: 'hours',
      goal_operator: 'gte',
      goal_value: 7,
      fields: [{ field_key: 'hours', label: 'Hours slept', field_type: 'number', unit: 'h', options: [], required: true, validation: { min: 0, max: 24 }, sort_order: 0 }],
      name: 'Sleep',
      description: null,
      icon: 'moon',
      color: 'lavender',
      frequency_days: [0, 1, 2, 3, 4, 5, 6],
      visibility: 'private',
      notes_enabled: false,
    } as unknown as HabitWithFields
    const s = builderFromHabit(habit)
    const renamed = withFieldKeys([{ ...s.fields[0]!, label: 'Sleep duration' }, field({ label: 'Hours' })])
    expect(renamed.map((f) => f.field_key)).toEqual(['hours', 'hours_2'])
  })

  it('round-trips existing definitions unchanged (no spurious new version)', () => {
    const defs = [
      { field_key: 'steps', label: 'Steps', field_type: 'number', unit: 'steps', options: [], required: true, validation: { min: 0, max: 200000, integer: true }, sort_order: 0 },
      { field_key: 'had_junk_food', label: 'Did you eat junk food?', field_type: 'radio', unit: null, options: ['No', 'Yes'], required: true, validation: {}, sort_order: 1 },
    ] as unknown as FieldDefinition[]
    const habit = {
      goal_field_key: 'had_junk_food', goal_operator: 'eq', goal_value: 'No', fields: defs, name: 'X', description: null, icon: 'cookie',
      color: 'rose', frequency_days: [1, 3], visibility: 'family', notes_enabled: true,
    } as unknown as HabitWithFields
    const s = builderFromHabit(habit)
    expect(toFieldDrafts(s)).toEqual(
      defs.map(({ field_key, label, field_type, unit, options, required, validation }) => ({ field_key, label, field_type, unit, options, required, validation })),
    )
    expect(toGoalDraft(s)).toEqual({ field_key: 'had_junk_food', operator: 'eq', value: 'No' })
  })

  it('clears a goal whose field becomes text or is removed', () => {
    const s = readingHabit()
    const asText = { ...s, fields: s.fields.map((f, i) => (i === 0 ? changeFieldType(f, 'text') : f)) }
    expect(reconcileGoal(asText).fieldUid).toBeNull()
    expect(reconcileGoal({ ...s, fields: s.fields.slice(1) }).fieldUid).toBeNull()
  })

  it('pads options when switching to a choice type and keeps data when switching back', () => {
    const f = field({ label: 'Mood', unit: 'pts' })
    const radio = changeFieldType(f, 'radio')
    expect(radio.options).toEqual(['', ''])
    expect(changeFieldType(radio, 'number').unit).toBe('pts')
  })
})
