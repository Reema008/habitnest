import { describe, expect, it } from 'vitest'
import { assignFieldKeys, isValidFieldKey, slugifyFieldKey, uniqueFieldKey } from './field-key'

describe('slugifyFieldKey', () => {
  it('lowercases and joins words with underscores', () => {
    expect(slugifyFieldKey('Hours read')).toBe('hours_read')
    expect(slugifyFieldKey('  Type of book  ')).toBe('type_of_book')
    expect(slugifyFieldKey('Completed / Not completed')).toBe('completed_not_completed')
  })

  it('strips accents and punctuation', () => {
    expect(slugifyFieldKey('Café visits!')).toBe('cafe_visits')
    expect(slugifyFieldKey('Did you eat junk food?')).toBe('did_you_eat_junk_food')
  })

  it('prefixes keys that would start with a digit', () => {
    expect(slugifyFieldKey('5k run')).toBe('f_5k_run')
  })

  it('falls back when nothing usable is left', () => {
    expect(slugifyFieldKey('')).toBe('field')
    expect(slugifyFieldKey('🙂 !!!')).toBe('field')
  })

  it('always produces keys matching the server pattern', () => {
    const long = 'A very long label that keeps going and going well past forty characters'
    for (const label of ['Study hours', '5k', long, '__x__', 'Ünïcödé', '']) {
      const key = slugifyFieldKey(label)
      expect(isValidFieldKey(key)).toBe(true)
      expect(key.length).toBeLessThanOrEqual(40)
      expect(key.endsWith('_')).toBe(false)
    }
  })
})

describe('uniqueFieldKey', () => {
  it('returns the base when free', () => {
    expect(uniqueFieldKey('hours', ['steps'])).toBe('hours')
  })

  it('adds a numeric suffix when taken', () => {
    expect(uniqueFieldKey('hours', ['hours'])).toBe('hours_2')
    expect(uniqueFieldKey('hours', ['hours', 'hours_2'])).toBe('hours_3')
  })

  it('stays within 40 characters when suffixing', () => {
    const base = 'a'.repeat(40)
    const key = uniqueFieldKey(base, [base])
    expect(key).toBe(`${'a'.repeat(38)}_2`)
    expect(isValidFieldKey(key)).toBe(true)
  })
})

describe('assignFieldKeys', () => {
  it('derives keys for new fields and keeps them unique', () => {
    const out = assignFieldKeys([
      { field_key: '', label: 'Notes', keyLocked: false },
      { field_key: '', label: 'Notes', keyLocked: false },
    ])
    expect(out.map((f) => f.field_key)).toEqual(['notes', 'notes_2'])
  })

  it('never changes a locked key when its label is renamed', () => {
    const out = assignFieldKeys([{ field_key: 'hours', label: 'Hours read', keyLocked: true }])
    expect(out[0]!.field_key).toBe('hours')
  })

  it('reserves locked keys so new fields cannot take them', () => {
    const out = assignFieldKeys([
      { field_key: '', label: 'Hours', keyLocked: false },
      { field_key: 'hours', label: 'Sleep time', keyLocked: true },
    ])
    expect(out.map((f) => f.field_key)).toEqual(['hours_2', 'hours'])
  })

  it('follows the label while the field is still new', () => {
    const first = assignFieldKeys([{ field_key: '', label: 'Study', keyLocked: false }])
    const renamed = assignFieldKeys([{ ...first[0]!, label: 'Study hours' }])
    expect(renamed[0]!.field_key).toBe('study_hours')
  })

  it('returns the same object when nothing changed', () => {
    const field = { field_key: 'subject', label: 'Subject', keyLocked: false }
    expect(assignFieldKeys([field])[0]).toBe(field)
  })
})
