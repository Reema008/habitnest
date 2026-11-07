/**
 * Client-side mirror of the server's completion rule (habit_entries_before_write), used for
 * instant UI feedback. The server's `is_complete` is always authoritative.
 *
 * - With a goal on a field of the entry's version: number → gte / lte / eq the goal value;
 *   radio / dropdown → equals the goal option. A missing goal value → not complete.
 * - Otherwise: complete once every required field is filled (and at least one value exists).
 */
import type { FieldValues, GoalOperator, Habit } from '@/types/models'
import { formatFieldValue, parseNumberInput, type FieldSpec } from './field-schema'

export type GoalLike = Pick<Habit, 'goal_field_key' | 'goal_operator' | 'goal_value'>

export const GOAL_OPERATOR_LABELS: Record<GoalOperator, string> = {
  gte: 'at least',
  lte: 'at most',
  eq: 'exactly',
}

function isPresent(v: unknown): boolean {
  return v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '')
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') return parseNumberInput(v)
  return null
}

export function isEntryComplete(habit: GoalLike, fieldsOfVersion: readonly FieldSpec[], values: FieldValues): boolean {
  if (!fieldsOfVersion.some((f) => isPresent(values[f.field_key]))) return false
  if (fieldsOfVersion.some((f) => f.required && !isPresent(values[f.field_key]))) return false

  const goalKey = habit.goal_field_key
  if (!goalKey || !habit.goal_operator) return true
  const goalField = fieldsOfVersion.find((f) => f.field_key === goalKey)
  // The goal does not apply to versions that don't have the goal field.
  if (!goalField) return true

  const value = values[goalKey]
  if (!isPresent(value)) return false

  if (goalField.field_type === 'number') {
    const n = toNumber(value)
    const target = toNumber(habit.goal_value)
    if (n === null || target === null) return false
    switch (habit.goal_operator) {
      case 'gte':
        return n >= target
      case 'lte':
        return n <= target
      default:
        return n === target
    }
  }
  return String(value) === String(habit.goal_value)
}

/** Short goal description, e.g. "Hours read: at least 1 h" or "Did you eat junk food? No". Null without a goal. */
export function describeGoal(habit: GoalLike, fields: readonly FieldSpec[]): string | null {
  const goalKey = habit.goal_field_key
  if (!goalKey || !habit.goal_operator || habit.goal_value === null || habit.goal_value === undefined) return null
  const field = fields.find((f) => f.field_key === goalKey)
  if (!field) return null
  const label = field.label.trim()
  const sep = /[?!:.]$/.test(label) ? ' ' : ': '
  if (field.field_type === 'number') {
    return `${label}${sep}${GOAL_OPERATOR_LABELS[habit.goal_operator]} ${formatFieldValue(field, habit.goal_value)}`
  }
  return `${label}${sep}${String(habit.goal_value)}`
}
