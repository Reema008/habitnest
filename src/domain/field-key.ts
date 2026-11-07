/**
 * Field keys identify a habit field inside `habit_entries.field_values`.
 * They are generated from the field label once and then stay stable, so renaming a label never
 * breaks historical entries, reports or goals. Must match the server rule ^[a-z][a-z0-9_]{0,39}$.
 */

export const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/
export const FIELD_KEY_MAX_LENGTH = 40
const FALLBACK_KEY = 'field'

export function isValidFieldKey(key: string): boolean {
  return FIELD_KEY_PATTERN.test(key)
}

/** Turns a label into a key candidate: "Hours read (h)" → "hours_read_h", "5k run" → "f_5k_run". */
export function slugifyFieldKey(label: string): string {
  let slug = label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (!slug) return FALLBACK_KEY
  if (!/^[a-z]/.test(slug)) slug = `f_${slug}`
  return trimKey(slug, FIELD_KEY_MAX_LENGTH)
}

function trimKey(key: string, max: number): string {
  const cut = key.slice(0, max).replace(/_+$/, '')
  return cut || FALLBACK_KEY
}

/** Returns `base`, or `base_2`, `base_3`, … — whichever is not taken (always ≤ 40 characters). */
export function uniqueFieldKey(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  const start = isValidFieldKey(base) ? base : slugifyFieldKey(base)
  if (!used.has(start)) return start
  for (let n = 2; ; n++) {
    const suffix = `_${n}`
    const candidate = `${trimKey(start, FIELD_KEY_MAX_LENGTH - suffix.length)}${suffix}`
    if (!used.has(candidate)) return candidate
  }
}

export type KeyedField = {
  field_key: string
  label: string
  /** True once the key is persisted (or otherwise fixed): it must never change again. */
  keyLocked: boolean
}

/**
 * Recomputes keys for fields that are not locked yet, keeping every locked key exactly as is.
 * Locked keys are reserved first so a new field can never take an existing field's key.
 * Fields keep their order; the returned array only contains new objects where a key changed.
 */
export function assignFieldKeys<T extends KeyedField>(fields: readonly T[]): T[] {
  const taken = new Set(fields.filter((f) => f.keyLocked).map((f) => f.field_key))
  return fields.map((f) => {
    if (f.keyLocked) return f
    const key = uniqueFieldKey(slugifyFieldKey(f.label), taken)
    taken.add(key)
    return key === f.field_key ? f : { ...f, field_key: key }
  })
}
