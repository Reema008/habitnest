import { describe, expect, it } from 'vitest'
import {
  durationMinutes, findOverlappingIds, formatDuration, formatTime, formatTimeLabel, groupByDay, isActiveAt,
  isValidRange, isValidTime, minutesSinceMidnight, normalizeTime, nowMarkerIndex, parseTime, rangesOverlap,
  sortSchedule, suggestSlot, WEEK_DAYS_MON_FIRST,
} from './schedule'

const item = (id: string, start: string, end: string, title = id, day = 1) => ({
  id,
  title,
  day_of_week: day,
  start_time: start,
  end_time: end,
})

describe('time parsing & formatting', () => {
  it('parses HH:MM and HH:MM:SS', () => {
    expect(parseTime('00:00')).toBe(0)
    expect(parseTime('07:30')).toBe(450)
    expect(parseTime('23:59:59')).toBe(1439)
    expect(parseTime('12:05:00.000')).toBe(725)
  })

  it('rejects invalid values', () => {
    for (const bad of ['', '24:00', '7:30', '12:60', 'noon', '12:30:61']) expect(parseTime(bad)).toBeNull()
    expect(parseTime(null)).toBeNull()
    expect(parseTime(undefined)).toBeNull()
    expect(isValidTime('25:00')).toBe(false)
    expect(isValidTime('08:15')).toBe(true)
  })

  it('formats and normalises', () => {
    expect(formatTime(0)).toBe('00:00')
    expect(formatTime(450)).toBe('07:30')
    expect(formatTime(5000)).toBe('23:59')
    expect(formatTime(-10)).toBe('00:00')
    expect(normalizeTime('08:15:00')).toBe('08:15')
    expect(normalizeTime('bad')).toBeNull()
  })

  it('formats labels for a locale', () => {
    expect(formatTimeLabel('14:05:00', { locale: 'en-US', hour12: true })).toBe('2:05 PM')
    expect(formatTimeLabel('14:05', { locale: 'en-GB', hour12: false })).toBe('14:05')
    expect(formatTimeLabel('oops')).toBe('oops')
  })
})

describe('durations', () => {
  it('computes minutes between start and end', () => {
    expect(durationMinutes(item('a', '09:00', '10:30'))).toBe(90)
    expect(durationMinutes(item('a', '10:00', '09:00'))).toBe(0)
    expect(durationMinutes(item('a', 'x', '09:00'))).toBe(0)
  })

  it('formats durations', () => {
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(60)).toBe('1 h')
    expect(formatDuration(90)).toBe('1 h 30 min')
    expect(formatDuration(-5)).toBe('0 min')
  })

  it('validates ranges (end must be after start)', () => {
    expect(isValidRange(item('a', '09:00', '09:01'))).toBe(true)
    expect(isValidRange(item('a', '09:00', '09:00'))).toBe(false)
    expect(isValidRange(item('a', '10:00', '09:00'))).toBe(false)
  })
})

describe('sorting', () => {
  it('sorts by start, end then title without mutating', () => {
    const input = [
      item('c', '10:00', '11:00', 'Zumba'),
      item('a', '08:00:00', '09:00:00', 'Breakfast'),
      item('d', '10:00', '10:30', 'Call'),
      item('b', '10:00', '11:00', 'Art'),
    ]
    expect(sortSchedule(input).map((i) => i.id)).toEqual(['a', 'd', 'b', 'c'])
    expect(input[0]!.id).toBe('c')
  })

  it('groups by day and sorts each day', () => {
    const groups = groupByDay([item('a', '10:00', '11:00', 'a', 1), item('b', '08:00', '09:00', 'b', 1), item('c', '08:00', '09:00', 'c', 0)])
    expect(groups[1]!.map((i) => i.id)).toEqual(['b', 'a'])
    expect(groups[0]!.map((i) => i.id)).toEqual(['c'])
    expect(groups[3]).toEqual([])
  })

  it('orders the week Monday first', () => {
    expect(WEEK_DAYS_MON_FIRST).toEqual([1, 2, 3, 4, 5, 6, 0])
  })
})

describe('overlaps', () => {
  it('treats ranges as half-open', () => {
    expect(rangesOverlap(item('a', '09:00', '10:00'), item('b', '10:00', '11:00'))).toBe(false)
    expect(rangesOverlap(item('a', '09:00', '10:01'), item('b', '10:00', '11:00'))).toBe(true)
    expect(rangesOverlap(item('a', '09:00', '12:00'), item('b', '10:00', '11:00'))).toBe(true)
  })

  it('finds every item involved in an overlap', () => {
    const ids = findOverlappingIds([
      item('a', '08:00', '09:00'),
      item('b', '08:30', '09:30'),
      item('c', '09:30', '10:00'),
      item('d', '11:00', '12:00'),
      item('e', '11:59', '12:30'),
    ])
    expect([...ids].sort()).toEqual(['a', 'b', 'd', 'e'])
  })

  it('returns an empty set with no overlaps', () => {
    expect(findOverlappingIds([item('a', '08:00', '09:00'), item('b', '09:00', '10:00')]).size).toBe(0)
  })
})

describe('now indicator', () => {
  const day = sortSchedule([item('a', '08:00', '09:00'), item('b', '12:00', '13:00')])

  it('detects the active item', () => {
    expect(isActiveAt(day[0]!, 8 * 60)).toBe(true)
    expect(isActiveAt(day[0]!, 9 * 60)).toBe(false)
  })

  it('places the marker between items or hides it when one is active', () => {
    expect(nowMarkerIndex(day, 7 * 60)).toBe(0)
    expect(nowMarkerIndex(day, 10 * 60)).toBe(1)
    expect(nowMarkerIndex(day, 14 * 60)).toBe(2)
    expect(nowMarkerIndex(day, 12 * 60 + 30)).toBeNull()
    expect(nowMarkerIndex([], 600)).toBe(0)
  })

  it('reads minutes since midnight from a date', () => {
    expect(minutesSinceMidnight(new Date(2026, 10, 8, 14, 32))).toBe(872)
  })
})

describe('suggestSlot', () => {
  it('defaults to 09:00 for an empty day', () => {
    expect(suggestSlot([])).toEqual({ start: '09:00', end: '10:00' })
  })

  it('starts after the last item', () => {
    expect(suggestSlot([item('a', '08:00', '09:30:00'), item('b', '07:00', '08:00')])).toEqual({ start: '09:30', end: '10:30' })
  })

  it('stays within the day', () => {
    expect(suggestSlot([item('a', '22:00', '23:30')])).toEqual({ start: '23:30', end: '23:59' })
    expect(suggestSlot([item('a', '22:00', '23:50')])).toEqual({ start: '09:00', end: '10:00' })
  })
})
