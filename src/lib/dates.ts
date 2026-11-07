/**
 * Date helpers. Habit entries are keyed by the user's *local* calendar day ("YYYY-MM-DD").
 * Everything here works with ISO date strings to avoid time zone drift.
 */
import {
  addDays, differenceInCalendarDays, eachDayOfInterval, endOfMonth, endOfWeek, format, isValid, parseISO,
  startOfMonth, startOfWeek,
} from 'date-fns'

export type ISODate = string // YYYY-MM-DD

export function toISODate(d: Date): ISODate {
  return format(d, 'yyyy-MM-dd')
}

/** Today in the device's local time zone. */
export function todayISO(): ISODate {
  return toISODate(new Date())
}

export function parseDate(iso: ISODate): Date {
  return parseISO(iso)
}

export function isISODate(value: string | undefined | null): value is ISODate {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value))
}

export function shiftDate(iso: ISODate, days: number): ISODate {
  return toISODate(addDays(parseISO(iso), days))
}

export function daysBetween(start: ISODate, end: ISODate): number {
  return differenceInCalendarDays(parseISO(end), parseISO(start))
}

export function eachDay(start: ISODate, end: ISODate): ISODate[] {
  if (start > end) return []
  return eachDayOfInterval({ start: parseISO(start), end: parseISO(end) }).map(toISODate)
}

/** Day of week 0 = Sunday … 6 = Saturday (matches Postgres `extract(dow)`). */
export function dayOfWeek(iso: ISODate): number {
  return parseISO(iso).getDay()
}

export function weekRange(iso: ISODate, weekStartsOn: 0 | 1 = 1): { start: ISODate; end: ISODate } {
  const d = parseISO(iso)
  return { start: toISODate(startOfWeek(d, { weekStartsOn })), end: toISODate(endOfWeek(d, { weekStartsOn })) }
}

export function monthRange(iso: ISODate): { start: ISODate; end: ISODate } {
  const d = parseISO(iso)
  return { start: toISODate(startOfMonth(d)), end: toISODate(endOfMonth(d)) }
}

export function formatDay(iso: ISODate, pattern = 'EEE d MMM'): string {
  return format(parseISO(iso), pattern)
}

export function friendlyDay(iso: ISODate): string {
  const diff = daysBetween(todayISO(), iso)
  if (diff === 0) return 'Today'
  if (diff === -1) return 'Yesterday'
  if (diff === 1) return 'Tomorrow'
  return formatDay(iso, 'EEEE, d MMM')
}

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
export const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

/** The device's IANA time zone (stored on the profile for server-side reminders). */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}
