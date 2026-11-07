import { WEEKDAY_LONG, WEEKDAY_SHORT } from '@/lib/dates'
import { toFieldValues, type FieldSpec } from '@/domain/field-schema'
import type { FieldDefinition, FieldValues, HabitEntry } from '@/types/models'

const WEEKDAYS = [1, 2, 3, 4, 5]
const WEEKEND = [0, 6]

function sameSet(a: readonly number[], b: readonly number[]) {
  return a.length === b.length && b.every((d) => a.includes(d))
}

/** "Every day", "Weekdays", "Weekends", "Mon, Wed, Fri". Ordered Monday-first for readability. */
export function frequencySummary(days: readonly number[]): string {
  const unique = [...new Set(days)].filter((d) => d >= 0 && d <= 6)
  if (unique.length === 7) return 'Every day'
  if (sameSet(unique, WEEKDAYS)) return 'Weekdays'
  if (sameSet(unique, WEEKEND)) return 'Weekends'
  if (unique.length === 1) return `Every ${WEEKDAY_LONG[unique[0]!]}`
  return [...unique]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((d) => WEEKDAY_SHORT[d])
    .join(', ')
}

/** Field definitions grouped by version, each version sorted by sort_order. */
export function definitionsByVersion(defs: readonly FieldDefinition[], habitId: string): Map<number, FieldDefinition[]> {
  const map = new Map<number, FieldDefinition[]>()
  for (const d of defs) {
    if (d.habit_id !== habitId) continue
    const list = map.get(d.version) ?? []
    list.push(d)
    map.set(d.version, list)
  }
  for (const list of map.values()) list.sort((a, b) => a.sort_order - b.sort_order)
  return map
}

export function entryValues(entry: Pick<HabitEntry, 'field_values'>): FieldValues {
  return toFieldValues(entry.field_values)
}

/** Fields of an entry that actually have a value, in definition order. */
export function filledFields(fields: readonly FieldSpec[], values: FieldValues): FieldSpec[] {
  return fields.filter((f) => {
    const v = values[f.field_key]
    return v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '')
  })
}
