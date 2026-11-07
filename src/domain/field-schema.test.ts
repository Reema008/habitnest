import { describe, expect, it } from 'vitest'
import type { FieldDraft } from '@/types/models'
import {
  buildEntrySchema, formatFieldValue, parseNumberInput, parseValidation, textMaxLength, toFieldValues, toFormValues,
} from './field-schema'

const hours: FieldDraft = {
  field_key: 'hours_read',
  label: 'Hours read',
  field_type: 'number',
  unit: 'h',
  options: [],
  required: true,
  validation: { min: 0, max: 24 },
}
const steps: FieldDraft = {
  field_key: 'steps',
  label: 'Steps',
  field_type: 'number',
  unit: 'steps',
  options: [],
  required: false,
  validation: { integer: true },
}
const bookType: FieldDraft = {
  field_key: 'type_of_book',
  label: 'Type of book',
  field_type: 'dropdown',
  options: ['Fiction', 'Non-fiction'],
  required: false,
  validation: {},
}
const done: FieldDraft = {
  field_key: 'completed',
  label: 'Completed',
  field_type: 'radio',
  options: ['Completed', 'Not completed'],
  required: true,
  validation: {},
}
const notes: FieldDraft = {
  field_key: 'notes',
  label: 'Notes',
  field_type: 'text',
  options: [],
  required: false,
  validation: { maxLength: 10 },
}

function issues(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  return (result.error?.issues ?? []).map((i) => ({ path: i.path.join('.'), message: i.message }))
}

describe('buildEntrySchema', () => {
  it('converts numbers and omits empty optional fields', () => {
    const schema = buildEntrySchema([hours, bookType, notes], false)
    const r = schema.safeParse({ values: { hours_read: ' 7.5 ', type_of_book: '', notes: '' }, notes: 'ignored' })
    expect(r.success).toBe(true)
    expect(r.data).toEqual({ values: { hours_read: 7.5 }, notes: null })
  })

  it('accepts a comma decimal separator', () => {
    const r = buildEntrySchema([hours], false).safeParse({ values: { hours_read: '7,5' } })
    expect(r.data?.values.hours_read).toBe(7.5)
  })

  it('requires required fields', () => {
    const r = buildEntrySchema([hours, done], false).safeParse({ values: { hours_read: '', completed: undefined } })
    expect(r.success).toBe(false)
    expect(issues(r)).toEqual([
      { path: 'values.hours_read', message: 'This field is required' },
      { path: 'values.completed', message: 'This field is required' },
    ])
  })

  it('rejects text where a number is expected', () => {
    const r = buildEntrySchema([hours], false).safeParse({ values: { hours_read: 'seven' } })
    expect(issues(r)[0]?.path).toBe('values.hours_read')
  })

  it('enforces min and max with units in the message', () => {
    const schema = buildEntrySchema([hours], false)
    expect(issues(schema.safeParse({ values: { hours_read: '-1' } }))[0]?.message).toBe('Must be at least 0 h')
    expect(issues(schema.safeParse({ values: { hours_read: '25' } }))[0]?.message).toBe('Must be at most 24 h')
    expect(schema.safeParse({ values: { hours_read: '24' } }).success).toBe(true)
  })

  it('rejects negative numbers when no minimum is set (server rule)', () => {
    const r = buildEntrySchema([steps], false).safeParse({ values: { steps: '-5' } })
    expect(r.success).toBe(false)
  })

  it('enforces whole numbers only when integer is set', () => {
    const schema = buildEntrySchema([steps, hours], false)
    expect(issues(schema.safeParse({ values: { steps: '1000.5', hours_read: '1' } }))[0]?.message).toBe('Use a whole number')
    expect(schema.safeParse({ values: { steps: '1000', hours_read: '1.25' } }).data?.values).toEqual({
      steps: 1000,
      hours_read: 1.25,
    })
  })

  it('rejects absurdly large numbers', () => {
    expect(buildEntrySchema([steps], false).safeParse({ values: { steps: '1000000000' } }).success).toBe(false)
  })

  it('only accepts defined options', () => {
    const schema = buildEntrySchema([bookType, done], false)
    expect(issues(schema.safeParse({ values: { type_of_book: 'Poetry', completed: 'Completed' } }))).toEqual([
      { path: 'values.type_of_book', message: 'Choose one of the options' },
    ])
    expect(schema.safeParse({ values: { type_of_book: 'Fiction', completed: 'Not completed' } }).data?.values).toEqual({
      type_of_book: 'Fiction',
      completed: 'Not completed',
    })
  })

  it('limits text length (custom max, default 500, hard cap 2000)', () => {
    const schema = buildEntrySchema([notes], false)
    expect(schema.safeParse({ values: { notes: 'a'.repeat(10) } }).success).toBe(true)
    expect(issues(schema.safeParse({ values: { notes: 'a'.repeat(11) } }))[0]?.message).toBe('Keep it to 10 characters or fewer')
    expect(textMaxLength({ validation: {} })).toBe(500)
    expect(textMaxLength({ validation: { maxLength: 5000 } })).toBe(2000)
  })

  it('needs at least one value when every field is optional', () => {
    const r = buildEntrySchema([bookType, notes], false).safeParse({ values: { type_of_book: '', notes: '  ' } })
    expect(issues(r)).toEqual([{ path: 'root', message: 'Enter at least one value' }])
  })

  it('drops unknown keys', () => {
    const r = buildEntrySchema([hours], false).safeParse({ values: { hours_read: '2', bogus: 'x' } })
    expect(r.data?.values).toEqual({ hours_read: 2 })
  })

  it('handles notes only when enabled, trimming and limiting them', () => {
    const on = buildEntrySchema([hours], true)
    expect(on.safeParse({ values: { hours_read: '1' }, notes: '  Great book  ' }).data?.notes).toBe('Great book')
    expect(on.safeParse({ values: { hours_read: '1' }, notes: '   ' }).data?.notes).toBeNull()
    expect(issues(on.safeParse({ values: { hours_read: '1' }, notes: 'x'.repeat(2001) }))[0]?.path).toBe('notes')
    expect(buildEntrySchema([hours], false).safeParse({ values: { hours_read: '1' }, notes: 'hi' }).data?.notes).toBeNull()
  })

  it('accepts prefilled numeric values', () => {
    expect(buildEntrySchema([hours], false).safeParse({ values: { hours_read: 8 } }).data?.values.hours_read).toBe(8)
  })

  it('reads validation stored as JSON on field definitions', () => {
    const def = { ...hours, validation: { min: 1, max: 'x', integer: 'yes' } as unknown }
    expect(parseValidation(def.validation)).toEqual({ min: 1 })
    expect(buildEntrySchema([def], false).safeParse({ values: { hours_read: '0.5' } }).success).toBe(false)
  })
})

describe('parseNumberInput', () => {
  it('parses plain numbers only', () => {
    expect(parseNumberInput('7.5')).toBe(7.5)
    expect(parseNumberInput('.5')).toBe(0.5)
    expect(parseNumberInput('-2')).toBe(-2)
    expect(parseNumberInput('1e5')).toBeNull()
    expect(parseNumberInput('12abc')).toBeNull()
    expect(parseNumberInput('')).toBeNull()
  })
})

describe('formatFieldValue', () => {
  it('formats numbers with tidy decimals and units', () => {
    expect(formatFieldValue(hours, 7.5)).toBe('7.5 h')
    expect(formatFieldValue(hours, 7)).toBe('7 h')
    expect(formatFieldValue(hours, 1 / 3)).toBe('0.33 h')
    expect(formatFieldValue(steps, 6000)).toBe('6,000 steps')
    expect(formatFieldValue({ field_type: 'number', unit: null }, 2.5)).toBe('2.5')
  })

  it('shows choices and text as-is, and a dash when empty', () => {
    expect(formatFieldValue(bookType, 'Fiction')).toBe('Fiction')
    expect(formatFieldValue(notes, '')).toBe('—')
    expect(formatFieldValue(hours, undefined)).toBe('—')
  })
})

describe('toFieldValues / toFormValues', () => {
  it('keeps only numbers and strings from stored JSON', () => {
    expect(toFieldValues({ a: 1, b: 'x', c: null, d: [1], e: true })).toEqual({ a: 1, b: 'x' })
    expect(toFieldValues(null)).toEqual({})
    expect(toFieldValues([1, 2])).toEqual({})
  })

  it('creates string form defaults for every field', () => {
    expect(toFormValues([hours, bookType], { hours_read: 7.5 })).toEqual({ hours_read: '7.5', type_of_book: '' })
  })
})
