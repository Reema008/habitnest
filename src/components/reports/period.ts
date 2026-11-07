import { addMonths, format, parseISO } from 'date-fns'
import { friendlyDay, monthRange, shiftDate, toISODate, weekRange, type ISODate } from '@/lib/dates'
import type { DateRange } from '@/domain/report-aggregates'

export type PeriodKind = 'day' | 'week' | 'month'

export const PERIOD_NOUN: Record<PeriodKind, string> = { day: 'day', week: 'week', month: 'month' }

export function periodRange(kind: PeriodKind, anchor: ISODate): DateRange {
  if (kind === 'day') return { start: anchor, end: anchor }
  return kind === 'week' ? weekRange(anchor, 1) : monthRange(anchor)
}

/** Anchor date of the period `step` periods away (negative = earlier). */
export function shiftPeriod(kind: PeriodKind, anchor: ISODate, step: number): ISODate {
  const start = periodRange(kind, anchor).start
  if (kind === 'day') return shiftDate(start, step)
  if (kind === 'week') return shiftDate(start, step * 7)
  return toISODate(addMonths(parseISO(start), step))
}

export function isCurrentPeriod(kind: PeriodKind, anchor: ISODate, today: ISODate): boolean {
  const r = periodRange(kind, anchor)
  return r.start <= today && today <= r.end
}

/** Next period only when it has already started. */
export function canGoNext(kind: PeriodKind, anchor: ISODate, today: ISODate): boolean {
  return periodRange(kind, shiftPeriod(kind, anchor, 1)).start <= today
}

export function periodTitle(kind: PeriodKind, anchor: ISODate, today: ISODate): string {
  const r = periodRange(kind, anchor)
  if (kind === 'day') return friendlyDay(anchor)
  if (kind === 'month') return isCurrentPeriod(kind, anchor, today) ? 'This month' : format(parseISO(r.start), 'MMMM yyyy')
  if (isCurrentPeriod(kind, anchor, today)) return 'This week'
  if (isCurrentPeriod(kind, shiftPeriod(kind, anchor, 1), today)) return 'Last week'
  return rangeLabel(r)
}

/** "3 – 9 Nov 2026", "28 Oct – 3 Nov 2026", "Dec 2025 – Jan 2026"-style range text. */
export function rangeLabel(r: DateRange): string {
  const s = parseISO(r.start)
  const e = parseISO(r.end)
  if (r.start === r.end) return format(s, 'd MMM yyyy')
  if (s.getFullYear() !== e.getFullYear()) return `${format(s, 'd MMM yyyy')} – ${format(e, 'd MMM yyyy')}`
  if (s.getMonth() !== e.getMonth()) return `${format(s, 'd MMM')} – ${format(e, 'd MMM yyyy')}`
  return `${format(s, 'd')} – ${format(e, 'd MMM yyyy')}`
}

/** Short x-axis label for a day. */
export function shortDay(iso: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? format(parseISO(iso), 'd MMM') : iso
}

/** Tooltip/table label for a day. */
export function longDay(iso: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? format(parseISO(iso), 'EEE d MMM yyyy') : iso
}

/** Clips a range so it never extends past today. */
export function clipToToday(r: DateRange, today: ISODate): DateRange {
  return { start: r.start, end: r.end > today ? today : r.end }
}
