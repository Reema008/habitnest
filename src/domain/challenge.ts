/**
 * Pure family-challenge logic: status relative to the local day, day counting, which of my habit
 * fields can take part, draft validation and friendly progress formatting.
 * No React, no Supabase.
 */
import { daysBetween, type ISODate } from '@/lib/dates'
import type { FamilyChallenge, FieldDefinition, HabitWithFields } from '@/types/models'

export type ChallengeStatus = 'upcoming' | 'active' | 'finished'
export type ChallengeAggregation = FamilyChallenge['aggregation']

type DateRange = Pick<FamilyChallenge, 'start_date' | 'end_date'>
type ChallengeMetric = Pick<FamilyChallenge, 'aggregation' | 'unit'>

/** Longest allowed challenge (end_date - start_date), mirrors the database constraint. */
export const MAX_CHALLENGE_SPAN_DAYS = 366
export const MAX_CHALLENGE_TARGET = 1e9

/** Quick presets for "Total amount" challenges. */
export const CHALLENGE_PRESETS = [
  { id: 'walking', metricLabel: 'Walking', unit: 'steps' },
  { id: 'water', metricLabel: 'Water', unit: 'L' },
  { id: 'reading', metricLabel: 'Reading', unit: 'h' },
  { id: 'exercise', metricLabel: 'Exercise', unit: 'h' },
  { id: 'sleep', metricLabel: 'Sleep', unit: 'h' },
] as const

export function challengeStatus(c: DateRange, today: ISODate): ChallengeStatus {
  if (today < c.start_date) return 'upcoming'
  if (today > c.end_date) return 'finished'
  return 'active'
}

/** Number of calendar days the challenge runs (inclusive). */
export function challengeLengthDays(c: DateRange): number {
  return Math.max(0, daysBetween(c.start_date, c.end_date) + 1)
}

/** Days left including today (0 once finished; the full length while upcoming). */
export function daysRemaining(c: DateRange, today: ISODate): number {
  const status = challengeStatus(c, today)
  if (status === 'finished') return 0
  if (status === 'upcoming') return challengeLengthDays(c)
  return daysBetween(today, c.end_date) + 1
}

/** Days already played including today (0 while upcoming; the full length once finished). */
export function daysElapsed(c: DateRange, today: ISODate): number {
  const status = challengeStatus(c, today)
  if (status === 'upcoming') return 0
  if (status === 'finished') return challengeLengthDays(c)
  return daysBetween(c.start_date, today) + 1
}

/** Days until the challenge starts (0 when it has started). */
export function daysUntilStart(c: DateRange, today: ISODate): number {
  return Math.max(0, daysBetween(today, c.start_date))
}

/** Short, friendly timing text: "3 days left", "Last day today", "Starts tomorrow", "Finished". */
export function timingLabel(c: DateRange, today: ISODate): string {
  const status = challengeStatus(c, today)
  if (status === 'finished') return 'Finished'
  if (status === 'upcoming') {
    const n = daysUntilStart(c, today)
    return n === 1 ? 'Starts tomorrow' : `Starts in ${n} days`
  }
  const left = daysRemaining(c, today)
  return left === 1 ? 'Last day today' : `${left} days left`
}

/** Units compare the way the database does: case-insensitively, missing unit = empty string. */
export function unitsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? '').toLowerCase() === (b ?? '').toLowerCase()
}

export type EligibleOption = {
  habit: HabitWithFields
  /** The number field used for "sum" challenges; null for "days completed". */
  field: FieldDefinition | null
}

/**
 * My habits (with current-version fields) that can join the challenge: they must be shared with
 * the family and not archived; "sum" challenges additionally need a number field whose unit matches.
 */
export function eligibleHabitFields(challenge: ChallengeMetric, habits: HabitWithFields[]): EligibleOption[] {
  const options: EligibleOption[] = []
  for (const habit of habits) {
    if (habit.visibility !== 'family' || habit.archived_at) continue
    if (challenge.aggregation === 'days_met') {
      options.push({ habit, field: null })
      continue
    }
    for (const field of habit.fields) {
      if (field.version !== habit.current_version) continue
      if (field.field_type === 'number' && unitsMatch(field.unit, challenge.unit)) options.push({ habit, field })
    }
  }
  return options
}

/** Stable key for an eligible option (habit + field). */
export function optionKey(habitId: string, fieldKey: string | null | undefined): string {
  return `${habitId}::${fieldKey ?? ''}`
}

/** Formats a number for display with up to two decimals. */
export function formatNumber(value: number, locale?: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)
}

/** The unit progress is measured in: the challenge unit for sums, "day(s)" for days completed. */
export function progressUnit(challenge: ChallengeMetric, amount: number): string {
  if (challenge.aggregation === 'days_met') return amount === 1 ? 'day' : 'days'
  return challenge.unit ?? ''
}

/** "1,250 steps", "2.5 L", "4 days". */
export function formatAmount(challenge: ChallengeMetric, amount: number, locale?: string): string {
  const unit = progressUnit(challenge, amount)
  const n = formatNumber(amount, locale)
  return unit ? `${n} ${unit}` : n
}

/** "1,250 / 10,000 steps" or "4 / 20 days". */
export function formatProgress(challenge: ChallengeMetric, progress: number, target: number, locale?: string): string {
  const unit = progressUnit(challenge, target)
  const text = `${formatNumber(progress, locale)} / ${formatNumber(target, locale)}`
  return unit ? `${text} ${unit}` : text
}

/** Clamped 0–100 percentage. */
export function percentOf(progress: number, target: number): number {
  if (!(target > 0) || !Number.isFinite(progress)) return 0
  return Math.max(0, Math.min(100, (progress / target) * 100))
}

/** Human description of what counts, e.g. "Total steps of Walking" / "Days the habit is completed". */
export function describeMetric(challenge: Pick<FamilyChallenge, 'aggregation' | 'unit' | 'metric_label'>): string {
  if (challenge.aggregation === 'days_met') return 'Days the linked habit is completed'
  return `Total ${challenge.metric_label.toLowerCase()}${challenge.unit ? ` (${challenge.unit})` : ''}`
}

export type ChallengeDraft = {
  title: string
  description: string
  aggregation: ChallengeAggregation
  metricLabel: string
  unit: string
  target: number
  startDate: ISODate
  endDate: ISODate
}

export type ChallengeDraftErrors = Partial<Record<keyof ChallengeDraft, string>>

/** Validates a challenge draft with the same rules the database enforces (plus a few friendly extras). */
export function validateChallengeDraft(d: ChallengeDraft): ChallengeDraftErrors {
  const errors: ChallengeDraftErrors = {}
  const title = d.title.trim()
  if (!title) errors.title = 'Give your challenge a name.'
  else if (title.length > 80) errors.title = 'Keep the name under 80 characters.'
  if (d.description.length > 300) errors.description = 'Keep the description under 300 characters.'

  if (d.aggregation === 'sum') {
    const label = d.metricLabel.trim()
    if (!label) errors.metricLabel = 'What are you adding up? e.g. Walking'
    else if (label.length > 40) errors.metricLabel = 'Keep this under 40 characters.'
    const unit = d.unit.trim()
    if (!unit) errors.unit = 'Add a unit, e.g. steps'
    else if (unit.length > 20) errors.unit = 'Keep the unit under 20 characters.'
  }

  const datesValid = /^\d{4}-\d{2}-\d{2}$/.test(d.startDate) && /^\d{4}-\d{2}-\d{2}$/.test(d.endDate)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.startDate)) errors.startDate = 'Choose a start date.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.endDate)) errors.endDate = 'Choose an end date.'
  if (datesValid) {
    const span = daysBetween(d.startDate, d.endDate)
    if (span < 0) errors.endDate = 'The end date must be on or after the start date.'
    else if (span > MAX_CHALLENGE_SPAN_DAYS) errors.endDate = 'Challenges can last up to a year.'
  }

  if (!Number.isFinite(d.target) || d.target <= 0) errors.target = 'The target must be more than 0.'
  else if (d.target >= MAX_CHALLENGE_TARGET) errors.target = 'That target is too large.'
  else if (d.aggregation === 'days_met') {
    if (!Number.isInteger(d.target)) errors.target = 'Use a whole number of days.'
    else if (datesValid && !errors.endDate && d.target > challengeLengthDays({ start_date: d.startDate, end_date: d.endDate })) {
      errors.target = 'The target can’t be more days than the challenge lasts.'
    }
  }
  return errors
}

export type ProgressRow = {
  userId: string
  displayName: string
  progress: number
  target: number
  percent: number
}

/** Gentle ordering for results: furthest along first, ties alphabetical. Never drops anyone. */
export function orderProgress<T extends ProgressRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.percent - a.percent || a.displayName.localeCompare(b.displayName))
}

/** Sum of everyone's progress — "together we walked …". */
export function combinedProgress(rows: Pick<ProgressRow, 'progress'>[]): number {
  return rows.reduce((sum, r) => sum + (Number.isFinite(r.progress) ? r.progress : 0), 0)
}

/** Number of participants who reached the target. */
export function reachedCount(rows: Pick<ProgressRow, 'percent'>[]): number {
  return rows.filter((r) => r.percent >= 100).length
}
