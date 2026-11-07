/**
 * Pure helpers for the personal weekly schedule: time parsing/formatting, sorting,
 * durations and gentle overlap detection. No React, no Supabase.
 *
 * Times come from Postgres `time` columns ("HH:MM:SS") or `<input type="time">` ("HH:MM").
 * Internally they are handled as minutes since midnight.
 */

export type TimeRange = { start_time: string; end_time: string }

/** Monday-first order of `day_of_week` values (0 = Sunday … 6 = Saturday). */
export const WEEK_DAYS_MON_FIRST = [1, 2, 3, 4, 5, 6, 0] as const

export const MINUTES_PER_DAY = 24 * 60
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d+)?)?$/

/** "HH:MM" or "HH:MM:SS" → minutes since midnight, or null when invalid. */
export function parseTime(value: string | null | undefined): number | null {
  if (!value) return null
  const match = TIME_PATTERN.exec(value.trim())
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

/** Minutes since midnight → "HH:MM" (clamped to 00:00 … 23:59). */
export function formatTime(minutes: number): string {
  const m = Math.min(MINUTES_PER_DAY - 1, Math.max(0, Math.floor(minutes)))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** Normalises any accepted time string to "HH:MM"; null when invalid. */
export function normalizeTime(value: string | null | undefined): string | null {
  const minutes = parseTime(value)
  return minutes === null ? null : formatTime(minutes)
}

export function isValidTime(value: string | null | undefined): boolean {
  return parseTime(value) !== null
}

/** Human time label, e.g. "7:30 AM" or "07:30" depending on locale (or explicit hour12). */
export function formatTimeLabel(value: string, opts: { locale?: string; hour12?: boolean } = {}): string {
  const minutes = parseTime(value)
  if (minutes === null) return value
  const date = new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60)
  return new Intl.DateTimeFormat(opts.locale, { hour: 'numeric', minute: '2-digit', hour12: opts.hour12 }).format(date)
}

/** Length of an item in minutes (0 when the range is invalid). */
export function durationMinutes(item: TimeRange): number {
  const start = parseTime(item.start_time)
  const end = parseTime(item.end_time)
  if (start === null || end === null) return 0
  return Math.max(0, end - start)
}

/** "45 min", "1 h", "1 h 30 min". */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

/** True when end is strictly after start (the database enforces the same rule). */
export function isValidRange(item: TimeRange): boolean {
  const start = parseTime(item.start_time)
  const end = parseTime(item.end_time)
  return start !== null && end !== null && end > start
}

/** Sorted copy: by start time, then end time, then title. */
export function sortSchedule<T extends TimeRange & { title: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const byStart = (parseTime(a.start_time) ?? 0) - (parseTime(b.start_time) ?? 0)
    if (byStart !== 0) return byStart
    const byEnd = (parseTime(a.end_time) ?? 0) - (parseTime(b.end_time) ?? 0)
    if (byEnd !== 0) return byEnd
    return a.title.localeCompare(b.title)
  })
}

/** Half-open overlap check: an item ending at 09:00 does not overlap one starting at 09:00. */
export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  const aStart = parseTime(a.start_time)
  const aEnd = parseTime(a.end_time)
  const bStart = parseTime(b.start_time)
  const bEnd = parseTime(b.end_time)
  if (aStart === null || aEnd === null || bStart === null || bEnd === null) return false
  return aStart < bEnd && bStart < aEnd
}

/** Ids of items that overlap at least one other item (same day assumed). */
export function findOverlappingIds<T extends TimeRange & { id: string }>(items: readonly T[]): Set<string> {
  const ids = new Set<string>()
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]!
      const b = items[j]!
      if (rangesOverlap(a, b)) {
        ids.add(a.id)
        ids.add(b.id)
      }
    }
  }
  return ids
}

export function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

/** Whether the given minute of the day falls inside the item (start inclusive, end exclusive). */
export function isActiveAt(item: TimeRange, minutes: number): boolean {
  const start = parseTime(item.start_time)
  const end = parseTime(item.end_time)
  if (start === null || end === null) return false
  return minutes >= start && minutes < end
}

/**
 * Where a "now" marker belongs in a sorted list: the index of the first item starting after `minutes`
 * (items.length when after all). Returns null when an item is in progress (that item is highlighted instead).
 */
export function nowMarkerIndex(sortedItems: readonly TimeRange[], minutes: number): number | null {
  if (sortedItems.some((item) => isActiveAt(item, minutes))) return null
  const index = sortedItems.findIndex((item) => (parseTime(item.start_time) ?? 0) > minutes)
  return index === -1 ? sortedItems.length : index
}

/** Items grouped by day_of_week (0–6), each group sorted. */
export function groupByDay<T extends TimeRange & { title: string; day_of_week: number }>(
  items: readonly T[],
): Record<number, T[]> {
  const groups: Record<number, T[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
  for (const item of items) groups[item.day_of_week]?.push(item)
  for (const day of Object.keys(groups)) groups[Number(day)] = sortSchedule(groups[Number(day)]!)
  return groups
}

/**
 * A sensible default slot for a new item: right after the day's last item (or 09:00 when empty),
 * one hour long, kept within the same day.
 */
export function suggestSlot(dayItems: readonly TimeRange[], durationMin = 60): { start: string; end: string } {
  const lastEnd = dayItems.reduce<number | null>((max, item) => {
    const end = parseTime(item.end_time)
    return end !== null && (max === null || end > max) ? end : max
  }, null)
  let start = lastEnd ?? 9 * 60
  if (start > MINUTES_PER_DAY - 1 - 15) start = 9 * 60
  const end = Math.min(MINUTES_PER_DAY - 1, start + durationMin)
  return { start: formatTime(start), end: formatTime(end) }
}
