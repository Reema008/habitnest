/**
 * State, validation and conversions for the habit builder (create & edit).
 * Pure functions only — the UI lives in habit-builder.tsx / field-editor.tsx.
 */
import type { HabitDraftMeta } from '@/api/habits'
import { assignFieldKeys, isValidFieldKey } from '@/domain/field-key'
import { parseNumberInput, parseValidation, TEXT_MAX_LENGTH_LIMIT } from '@/domain/field-schema'
import type { GoalLike } from '@/domain/completion'
import {
  HABIT_COLORS, type FieldDraft, type FieldType, type FieldValidation, type GoalDraft, type GoalOperator, type HabitColor,
  type HabitVisibility, type HabitWithFields,
} from '@/types/models'

export const NAME_MAX = 60
export const DESCRIPTION_MAX = 300
export const LABEL_MAX = 60
export const UNIT_MAX = 20
export const OPTION_MAX = 60
export const MIN_FIELDS = 1
export const MAX_FIELDS = 12
export const MIN_OPTIONS = 2
export const MAX_OPTIONS = 20
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  number: 'Number',
  text: 'Text',
  radio: 'Radio buttons',
  dropdown: 'Dropdown',
}
export const FIELD_TYPES: FieldType[] = ['number', 'text', 'radio', 'dropdown']

export function isChoiceType(t: FieldType): boolean {
  return t === 'radio' || t === 'dropdown'
}

export type BuilderField = {
  /** Local identity for React keys / goal references (keys may still change while new). */
  uid: string
  field_key: string
  /** Persisted fields keep their key forever, even when the label is renamed. */
  keyLocked: boolean
  label: string
  field_type: FieldType
  unit: string
  options: string[]
  required: boolean
  min: string
  max: string
  integer: boolean
  maxLength: string
}

export type BuilderGoal = { fieldUid: string | null; operator: GoalOperator; value: string }

export type BuilderState = {
  name: string
  description: string
  icon: string
  color: HabitColor
  frequencyDays: number[]
  visibility: HabitVisibility
  notesEnabled: boolean
  fields: BuilderField[]
  goal: BuilderGoal
}

let uidCounter = 0
export function newUid(): string {
  uidCounter += 1
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `f-${Date.now()}-${uidCounter}`
}

export function emptyField(type: FieldType = 'number'): BuilderField {
  return {
    uid: newUid(),
    field_key: '',
    keyLocked: false,
    label: '',
    field_type: type,
    unit: '',
    options: isChoiceType(type) ? ['', ''] : [],
    required: true,
    min: type === 'number' ? '0' : '',
    max: '',
    integer: false,
    maxLength: '',
  }
}

export function emptyBuilder(): BuilderState {
  return {
    name: '',
    description: '',
    icon: 'sparkles',
    color: 'lavender',
    frequencyDays: [...ALL_DAYS],
    visibility: 'private',
    notesEnabled: false,
    fields: withFieldKeys([emptyField()]),
    goal: { fieldUid: null, operator: 'gte', value: '' },
  }
}

function asColor(c: string): HabitColor {
  return (HABIT_COLORS as readonly string[]).includes(c) ? (c as HabitColor) : 'lavender'
}

const numToText = (n: number | undefined) => (n === undefined ? '' : String(n))

/** Prefills the builder from an existing habit's current version (all keys locked). */
export function builderFromHabit(habit: HabitWithFields): BuilderState {
  const fields: BuilderField[] = habit.fields.map((d) => {
    const v = parseValidation(d.validation)
    return {
      uid: newUid(),
      field_key: d.field_key,
      keyLocked: true,
      label: d.label,
      field_type: d.field_type,
      unit: d.unit ?? '',
      options: isChoiceType(d.field_type) ? [...d.options] : [],
      required: d.required,
      min: numToText(v.min),
      max: numToText(v.max),
      integer: !!v.integer,
      maxLength: numToText(v.maxLength),
    }
  })
  const goalField = fields.find((f) => f.field_key === habit.goal_field_key)
  return {
    name: habit.name,
    description: habit.description ?? '',
    icon: habit.icon,
    color: asColor(habit.color),
    frequencyDays: [...habit.frequency_days].sort((a, b) => a - b),
    visibility: habit.visibility,
    notesEnabled: habit.notes_enabled,
    fields,
    goal: goalField
      ? {
          fieldUid: goalField.uid,
          operator: habit.goal_operator ?? 'gte',
          value: habit.goal_value === null || habit.goal_value === undefined ? '' : String(habit.goal_value),
        }
      : { fieldUid: null, operator: 'gte', value: '' },
  }
}

/** Re-derives keys of new fields from their labels (locked keys never change). */
export function withFieldKeys(fields: BuilderField[]): BuilderField[] {
  return assignFieldKeys(fields)
}

/** Changes a field's type, keeping entered data so switching back loses nothing. */
export function changeFieldType(field: BuilderField, type: FieldType): BuilderField {
  const next: BuilderField = { ...field, field_type: type }
  if (isChoiceType(type)) {
    const opts = [...field.options]
    while (opts.length < MIN_OPTIONS) opts.push('')
    next.options = opts
  }
  return next
}

/** Keeps the goal consistent after fields changed (removed field, new type, text type). */
export function reconcileGoal(state: BuilderState): BuilderGoal {
  const { goal } = state
  if (!goal.fieldUid) return goal
  const field = state.fields.find((f) => f.uid === goal.fieldUid)
  if (!field || field.field_type === 'text') return { fieldUid: null, operator: 'gte', value: '' }
  if (isChoiceType(field.field_type)) {
    const options = cleanOptions(field.options)
    return { fieldUid: field.uid, operator: 'eq', value: options.includes(goal.value) ? goal.value : '' }
  }
  return goal
}

export function cleanOptions(options: readonly string[]): string[] {
  return options.map((o) => o.trim()).filter(Boolean)
}

export type BuilderErrors = Record<string, string>

export const errorKey = {
  field: (uid: string, part: 'label' | 'unit' | 'options' | 'min' | 'max' | 'maxLength') => `field.${uid}.${part}`,
  option: (uid: string, index: number) => `field.${uid}.option.${index}`,
}

/** Validates the builder like the server does; returns a map of error key → friendly message. */
export function validateBuilder(state: BuilderState): BuilderErrors {
  const errors: BuilderErrors = {}
  const name = state.name.trim()
  if (!name) errors.name = 'Give your habit a name'
  else if (name.length > NAME_MAX) errors.name = `Keep the name to ${NAME_MAX} characters or fewer`
  if (state.description.trim().length > DESCRIPTION_MAX) errors.description = `Keep the description to ${DESCRIPTION_MAX} characters or fewer`
  if (!state.frequencyDays.length) errors.frequency = 'Pick at least one day'

  if (state.fields.length < MIN_FIELDS) errors.fields = 'Add at least one field'
  if (state.fields.length > MAX_FIELDS) errors.fields = `A habit can have up to ${MAX_FIELDS} fields`

  const keys = new Set<string>()
  for (const f of state.fields) {
    const label = f.label.trim()
    if (!label) errors[errorKey.field(f.uid, 'label')] = 'Add a label'
    else if (label.length > LABEL_MAX) errors[errorKey.field(f.uid, 'label')] = `Keep labels to ${LABEL_MAX} characters or fewer`
    if (!isValidFieldKey(f.field_key) || keys.has(f.field_key)) {
      errors[errorKey.field(f.uid, 'label')] ??= 'Use a different label for this field'
    }
    keys.add(f.field_key)

    if (f.field_type === 'number') {
      if (f.unit.trim().length > UNIT_MAX) errors[errorKey.field(f.uid, 'unit')] = `Keep units to ${UNIT_MAX} characters or fewer`
      const min = f.min.trim() ? parseNumberInput(f.min) : undefined
      const max = f.max.trim() ? parseNumberInput(f.max) : undefined
      if (min === null) errors[errorKey.field(f.uid, 'min')] = 'Enter a number'
      if (max === null) errors[errorKey.field(f.uid, 'max')] = 'Enter a number'
      if (typeof min === 'number' && typeof max === 'number' && min > max) {
        errors[errorKey.field(f.uid, 'max')] = 'Maximum must be at least the minimum'
      }
    } else if (f.field_type === 'text') {
      if (f.maxLength.trim()) {
        const n = parseNumberInput(f.maxLength)
        if (n === null || !Number.isInteger(n) || n < 1 || n > TEXT_MAX_LENGTH_LIMIT) {
          errors[errorKey.field(f.uid, 'maxLength')] = `Use a whole number from 1 to ${TEXT_MAX_LENGTH_LIMIT}`
        }
      }
    } else {
      const seen = new Map<string, number>()
      f.options.forEach((raw, i) => {
        const o = raw.trim()
        if (!o) {
          errors[errorKey.option(f.uid, i)] = 'Fill in this option or remove it'
          return
        }
        if (o.length > OPTION_MAX) errors[errorKey.option(f.uid, i)] = `Keep options to ${OPTION_MAX} characters or fewer`
        const lower = o.toLowerCase()
        if (seen.has(lower)) errors[errorKey.option(f.uid, i)] = 'Options must be unique'
        else seen.set(lower, i)
      })
      const count = cleanOptions(f.options).length
      if (count < MIN_OPTIONS) errors[errorKey.field(f.uid, 'options')] = `Add at least ${MIN_OPTIONS} options`
      if (f.options.length > MAX_OPTIONS) errors[errorKey.field(f.uid, 'options')] = `Up to ${MAX_OPTIONS} options`
    }
  }

  const { goal } = state
  if (goal.fieldUid) {
    const field = state.fields.find((f) => f.uid === goal.fieldUid)
    if (!field) errors['goal.field'] = 'Choose a field for your goal'
    else if (field.field_type === 'text') errors['goal.field'] = "Text fields can't be used as a goal"
    else if (field.field_type === 'number') {
      const value = parseNumberInput(goal.value)
      if (value === null) errors['goal.value'] = 'Enter a goal number'
      else if (Math.abs(value) >= 1e9) errors['goal.value'] = 'That number is too large'
    } else if (!cleanOptions(field.options).includes(goal.value.trim())) {
      errors['goal.value'] = 'Choose the option that counts as done'
    }
  }
  return errors
}

export function toFieldDrafts(state: BuilderState): FieldDraft[] {
  return state.fields.map((f) => {
    const validation: FieldValidation = {}
    if (f.field_type === 'number') {
      const min = f.min.trim() ? parseNumberInput(f.min) : null
      const max = f.max.trim() ? parseNumberInput(f.max) : null
      if (min !== null) validation.min = min
      if (max !== null) validation.max = max
      if (f.integer) validation.integer = true
    } else if (f.field_type === 'text' && f.maxLength.trim()) {
      const n = parseNumberInput(f.maxLength)
      if (n !== null) validation.maxLength = n
    }
    return {
      field_key: f.field_key,
      label: f.label.trim(),
      field_type: f.field_type,
      unit: f.field_type === 'number' ? f.unit.trim() || null : null,
      options: isChoiceType(f.field_type) ? cleanOptions(f.options) : [],
      required: f.required,
      validation,
    }
  })
}

export function toGoalDraft(state: BuilderState): GoalDraft {
  const { goal } = state
  if (!goal.fieldUid) return null
  const field = state.fields.find((f) => f.uid === goal.fieldUid)
  if (!field || field.field_type === 'text') return null
  if (field.field_type === 'number') {
    const value = parseNumberInput(goal.value)
    return value === null ? null : { field_key: field.field_key, operator: goal.operator, value }
  }
  return { field_key: field.field_key, operator: 'eq', value: goal.value.trim() }
}

export function goalLikeFromDraft(goal: GoalDraft): GoalLike {
  return goal
    ? { goal_field_key: goal.field_key, goal_operator: goal.operator, goal_value: goal.value }
    : { goal_field_key: null, goal_operator: null, goal_value: null }
}

export function toHabitMeta(state: BuilderState): HabitDraftMeta {
  return {
    name: state.name.trim(),
    description: state.description.trim() || null,
    icon: state.icon,
    color: state.color,
    visibility: state.visibility,
    notes_enabled: state.notesEnabled,
    frequency_days: [...new Set(state.frequencyDays)].sort((a, b) => a - b),
  }
}
