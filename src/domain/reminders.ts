/**
 * Pure helpers for reminder times. Reminder times are stored as Postgres `time` values
 * ("HH:MM:SS") and are interpreted in the user's profile time zone (an IANA name).
 */
import { TZDate } from '@date-fns/tz'

/** A wall-clock time "HH:MM" (24-hour, zero padded). */
export type ClockTime = string

export type ParsedTime = { hours: number; minutes: number }

const TIME_PATTERN = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/

/** Parses "H:MM", "HH:MM" or "HH:MM:SS" (as returned by Postgres). Returns null when invalid. */
export function parseClockTime(value: string | null | undefined): ParsedTime | null {
  if (!value) return null
  const match = TIME_PATTERN.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = match[3] === undefined ? 0 : Number(match[3])
  if (hours > 23 || minutes > 59 || seconds > 59) return null
  return { hours, minutes }
}

export function isValidClockTime(value: string | null | undefined): boolean {
  return parseClockTime(value) !== null
}

/** Normalises a time to "HH:MM" (seconds dropped). Returns null when invalid. */
export function normalizeClockTime(value: string | null | undefined): ClockTime | null {
  const t = parseClockTime(value)
  if (!t) return null
  return `${String(t.hours).padStart(2, '0')}:${String(t.minutes).padStart(2, '0')}`
}

/** "20:00" → "8:00 pm", "00:15" → "12:15 am". Invalid input is returned unchanged. */
export function formatClockTime(value: string): string {
  const t = parseClockTime(value)
  if (!t) return value
  const suffix = t.hours < 12 ? 'am' : 'pm'
  const h12 = t.hours % 12 === 0 ? 12 : t.hours % 12
  return `${h12}:${String(t.minutes).padStart(2, '0')} ${suffix}`
}

/** True when the runtime knows the IANA time zone name. */
export function isValidTimeZone(timeZone: string | null | undefined): boolean {
  if (!timeZone) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

export type NextOccurrence = {
  /** The instant the reminder is next due. */
  at: Date
  /** 0 = later today, 1 = tomorrow (in the given time zone). */
  dayOffset: 0 | 1
}

/**
 * Next instant at which `time` occurs on the wall clock of `timeZone`, strictly after `now`.
 * Handles DST: a wall time that does not exist on a given day resolves to the shifted instant.
 */
export function nextOccurrence(time: string, timeZone: string, now: Date = new Date()): NextOccurrence | null {
  const t = parseClockTime(time)
  if (!t || !isValidTimeZone(timeZone)) return null
  const local = new TZDate(now.getTime(), timeZone)
  const y = local.getFullYear()
  const m = local.getMonth()
  const d = local.getDate()
  const today = new TZDate(y, m, d, t.hours, t.minutes, 0, 0, timeZone)
  if (today.getTime() > now.getTime()) return { at: new Date(today.getTime()), dayOffset: 0 }
  const tomorrow = new TZDate(y, m, d + 1, t.hours, t.minutes, 0, 0, timeZone)
  return { at: new Date(tomorrow.getTime()), dayOffset: 1 }
}

/**
 * Human text for the next reminder, e.g. "today at 8:00 pm" or "tomorrow at 7:30 am".
 * Returns null for an invalid time or time zone.
 */
export function describeNextReminder(time: string, timeZone: string, now: Date = new Date()): string | null {
  const next = nextOccurrence(time, timeZone, now)
  if (!next) return null
  return `${next.dayOffset === 0 ? 'today' : 'tomorrow'} at ${formatClockTime(time)}`
}

/** Readable time zone label: "Europe/London" → "London", "America/Argentina/Buenos_Aires" → "Buenos Aires". */
export function timeZoneLabel(timeZone: string): string {
  const last = timeZone.split('/').pop() ?? timeZone
  return last.replace(/_/g, ' ')
}
