/**
 * Entry validation for habit fields. Mirrors the server trigger `habit_entries_before_write`
 * (required, number type, min/max, whole numbers, option membership, text length, at least one
 * value) so users get instant feedback; the server stays authoritative.
 */
import { z } from 'zod'
import type { FieldType, FieldValidation, FieldValue, FieldValues } from '@/types/models'

/** The subset of a field definition needed to validate / format values (FieldDefinition or FieldDraft). */
export type FieldSpec = {
  field_key: string
  label: string
  field_type: FieldType
  unit?: string | null
  options: readonly string[]
  required: boolean
  /** FieldValidation, or the raw JSON stored in habit_field_definitions.validation. */
  validation: unknown
}

export const TEXT_MAX_LENGTH_DEFAULT = 500
export const TEXT_MAX_LENGTH_LIMIT = 2000
export const NOTES_MAX_LENGTH = 2000
/** Server rejects |value| >= 1e9. */
export const NUMBER_ABS_LIMIT = 1e9

/** Reads a validation object defensively (unknown keys / wrong types are ignored, like the server). */
export function parseValidation(raw: unknown): FieldValidation {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const r = raw as Record<string, unknown>
  const out: FieldValidation = {}
  if (typeof r.min === 'number' && Number.isFinite(r.min)) out.min = r.min
  if (typeof r.max === 'number' && Number.isFinite(r.max)) out.max = r.max
  if (typeof r.integer === 'boolean') out.integer = r.integer
  if (typeof r.maxLength === 'number' && Number.isFinite(r.maxLength)) out.maxLength = r.maxLength
  return out
}

/** Effective maximum length of a text field (server: least(coalesce(maxLength, 500), 2000)). */
export function textMaxLength(field: Pick<FieldSpec, 'validation'>): number {
  const { maxLength } = parseValidation(field.validation)
  return Math.min(maxLength ?? TEXT_MAX_LENGTH_DEFAULT, TEXT_MAX_LENGTH_LIMIT)
}

/** Parses user input such as "7.5", "7,5", " 12 " into a number; null when it is not a plain number. */
export function parseNumberInput(raw: string): number | null {
  let s = raw.trim()
  if (!s.includes('.') && /^[-+]?\d*,\d+$/.test(s)) s = s.replace(',', '.')
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const numberFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 2 })

/** "7.5", "6,000", "0.33" — never long float tails. */
export function formatNumber(n: number): string {
  return numberFormat.format(n)
}

/** Human-readable value with unit, e.g. "7.5 h", "6,000 steps", "Fiction". Empty → "—". */
export function formatFieldValue(def: Pick<FieldSpec, 'field_type' | 'unit'>, value: unknown): string {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) return '—'
  if (def.field_type === 'number') {
    const n = typeof value === 'number' ? value : parseNumberInput(String(value))
    if (n === null || !Number.isFinite(n)) return String(value)
    const unit = def.unit?.trim()
    return unit ? `${formatNumber(n)} ${unit}` : formatNumber(n)
  }
  return String(value)
}

/** Safely reads habit_entries.field_values (JSON) into FieldValues, dropping anything unexpected. */
export function toFieldValues(raw: unknown): FieldValues {
  const out: FieldValues = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
    else if (typeof v === 'string') out[k] = v
  }
  return out
}

/** Raw form state of an entry form: inputs hold strings (numbers allowed for prefilled values). */
export type EntryFormInput = {
  values: Record<string, string | number | null | undefined>
  notes?: string | null
}

/** What a valid entry form produces: numbers as numbers, other values as strings, empty optionals omitted. */
export type EntrySubmission = { values: FieldValues; notes: string | null }

const rawValue = z.union([z.string(), z.number()]).nullish()

function fieldValueSchema(def: FieldSpec) {
  const rules = parseValidation(def.validation)
  const unit = def.unit?.trim()
  const withUnit = (n: number) => (unit ? `${formatNumber(n)} ${unit}` : formatNumber(n))

  return rawValue.transform((raw, ctx): FieldValue | undefined => {
    const fail = (message: string) => {
      ctx.addIssue({ code: 'custom', message })
      return z.NEVER
    }
    const value = typeof raw === 'string' ? raw.trim() : raw
    if (value === undefined || value === null || value === '') {
      return def.required ? fail('This field is required') : undefined
    }

    switch (def.field_type) {
      case 'number': {
        const n = typeof value === 'number' ? value : parseNumberInput(value)
        if (n === null || !Number.isFinite(n)) return fail('Enter a number, like 7 or 7.5')
        if (n < 0 && rules.min === undefined) return fail("This can't be negative")
        if (rules.min !== undefined && n < rules.min) return fail(`Must be at least ${withUnit(rules.min)}`)
        if (rules.max !== undefined && n > rules.max) return fail(`Must be at most ${withUnit(rules.max)}`)
        if (rules.integer && !Number.isInteger(n)) return fail('Use a whole number')
        if (Math.abs(n) >= NUMBER_ABS_LIMIT) return fail('That number is too large')
        return n
      }
      case 'text': {
        const text = String(value)
        const max = textMaxLength(def)
        if ([...text].length > max) return fail(`Keep it to ${max} characters or fewer`)
        return text
      }
      default: {
        const choice = String(value)
        if (!def.options.includes(choice)) return fail('Choose one of the options')
        return choice
      }
    }
  })
}

function notesSchema(notesEnabled: boolean) {
  return z
    .string()
    .nullish()
    .transform((raw, ctx): string | null => {
      if (!notesEnabled) return null
      const text = (raw ?? '').trim()
      if (!text) return null
      if ([...text].length > NOTES_MAX_LENGTH) {
        ctx.addIssue({ code: 'custom', message: `Notes can be up to ${NOTES_MAX_LENGTH} characters` })
        return z.NEVER
      }
      return text
    })
}

/**
 * Zod schema for an entry form of a habit version. Parse `{ values, notes }` (raw input strings)
 * to get `{ values: FieldValues, notes }` ready for saveEntry. Field errors are reported at
 * `values.<field_key>`, notes errors at `notes`, and "nothing entered" at `root`.
 */
export function buildEntrySchema(
  fields: readonly FieldSpec[],
  notesEnabled: boolean,
): z.ZodType<EntrySubmission, EntryFormInput> {
  const shape: Record<string, ReturnType<typeof fieldValueSchema>> = {}
  for (const f of fields) shape[f.field_key] = fieldValueSchema(f)

  return z
    .object({ values: z.object(shape), notes: notesSchema(notesEnabled) })
    .transform((data, ctx): EntrySubmission => {
      const values: FieldValues = {}
      for (const f of fields) {
        const v = data.values[f.field_key]
        if (v !== undefined) values[f.field_key] = v
      }
      if (Object.keys(values).length === 0) {
        ctx.addIssue({ code: 'custom', message: 'Enter at least one value', path: ['root'] })
        return z.NEVER
      }
      return { values, notes: data.notes }
    })
}

/** Converts saved values into form input strings. */
export function toFormValues(fields: readonly FieldSpec[], values: FieldValues | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of fields) {
    const v = values?.[f.field_key]
    out[f.field_key] = v === undefined || v === null ? '' : String(v)
  }
  return out
}
