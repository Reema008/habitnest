import { describe, expect, it } from 'vitest'
import {
  describeNextReminder, formatClockTime, isValidClockTime, isValidTimeZone, nextOccurrence, normalizeClockTime,
  parseClockTime, timeZoneLabel,
} from './reminders'

describe('parseClockTime / normalizeClockTime', () => {
  it('accepts HH:MM, H:MM and Postgres HH:MM:SS', () => {
    expect(parseClockTime('20:00')).toEqual({ hours: 20, minutes: 0 })
    expect(parseClockTime('7:05')).toEqual({ hours: 7, minutes: 5 })
    expect(parseClockTime('21:30:00')).toEqual({ hours: 21, minutes: 30 })
    expect(parseClockTime(' 08:15:59.123 ')).toEqual({ hours: 8, minutes: 15 })
  })

  it('rejects malformed or out-of-range values', () => {
    for (const v of ['', '24:00', '12:60', '12', 'ab:cd', '12:5', '12:00:61', null, undefined]) {
      expect(parseClockTime(v)).toBeNull()
      expect(isValidClockTime(v)).toBe(false)
    }
  })

  it('normalises to zero-padded HH:MM', () => {
    expect(normalizeClockTime('7:05')).toBe('07:05')
    expect(normalizeClockTime('21:30:00')).toBe('21:30')
    expect(normalizeClockTime('25:00')).toBeNull()
  })
})

describe('formatClockTime', () => {
  it('formats 12-hour times with lowercase am/pm', () => {
    expect(formatClockTime('20:00')).toBe('8:00 pm')
    expect(formatClockTime('00:15:00')).toBe('12:15 am')
    expect(formatClockTime('12:00')).toBe('12:00 pm')
    expect(formatClockTime('09:05')).toBe('9:05 am')
  })

  it('returns invalid input unchanged', () => {
    expect(formatClockTime('nope')).toBe('nope')
  })
})

describe('isValidTimeZone', () => {
  it('knows IANA names', () => {
    expect(isValidTimeZone('Europe/London')).toBe(true)
    expect(isValidTimeZone('UTC')).toBe(true)
    expect(isValidTimeZone('Mars/Olympus')).toBe(false)
    expect(isValidTimeZone('')).toBe(false)
  })
})

describe('nextOccurrence', () => {
  it('returns later today when the time has not passed in that zone', () => {
    // London is on GMT (UTC+0) in November.
    const now = new Date('2026-11-08T10:00:00Z')
    const next = nextOccurrence('20:00', 'Europe/London', now)
    expect(next?.dayOffset).toBe(0)
    expect(next?.at.toISOString()).toBe('2026-11-08T20:00:00.000Z')
  })

  it('rolls over to tomorrow when the time has passed', () => {
    const now = new Date('2026-11-08T21:00:00Z')
    const next = nextOccurrence('20:00', 'UTC', now)
    expect(next?.dayOffset).toBe(1)
    expect(next?.at.toISOString()).toBe('2026-11-09T20:00:00.000Z')
  })

  it('treats the exact due instant as already passed', () => {
    const now = new Date('2026-11-08T20:00:00Z')
    expect(nextOccurrence('20:00', 'UTC', now)?.dayOffset).toBe(1)
  })

  it('uses the given zone, not the device zone', () => {
    // 2026-11-08 23:30 UTC is already 2026-11-09 08:30 in Tokyo (UTC+9).
    const now = new Date('2026-11-08T23:30:00Z')
    const next = nextOccurrence('09:00', 'Asia/Tokyo', now)
    expect(next?.dayOffset).toBe(0)
    expect(next?.at.toISOString()).toBe('2026-11-09T00:00:00.000Z')
  })

  it('handles a DST change (New York falls back on 2026-11-01)', () => {
    const now = new Date('2026-10-31T23:00:00Z') // 19:00 EDT on Oct 31
    const next = nextOccurrence('08:00', 'America/New_York', now)
    expect(next?.dayOffset).toBe(1)
    expect(next?.at.toISOString()).toBe('2026-11-01T13:00:00.000Z') // 08:00 EST
  })

  it('returns null for bad input', () => {
    expect(nextOccurrence('bad', 'UTC')).toBeNull()
    expect(nextOccurrence('08:00', 'Nowhere/Land')).toBeNull()
  })
})

describe('describeNextReminder', () => {
  it('describes today and tomorrow', () => {
    expect(describeNextReminder('20:00:00', 'UTC', new Date('2026-11-08T10:00:00Z'))).toBe('today at 8:00 pm')
    expect(describeNextReminder('07:30', 'UTC', new Date('2026-11-08T10:00:00Z'))).toBe('tomorrow at 7:30 am')
    expect(describeNextReminder('7:30', 'Not/AZone')).toBeNull()
  })
})

describe('timeZoneLabel', () => {
  it('uses the city part', () => {
    expect(timeZoneLabel('Europe/London')).toBe('London')
    expect(timeZoneLabel('America/Argentina/Buenos_Aires')).toBe('Buenos Aires')
    expect(timeZoneLabel('UTC')).toBe('UTC')
  })
})
