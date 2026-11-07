import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getFamilyLeaderboard, getFamilyMetricSeries } from '@/api/reports'
import { buildPersonalReport, habitsForReport, type DateRange, type PersonalReport } from '@/domain/report-aggregates'
import { groupComparableMetrics, type ComparableMetric } from '@/domain/metric-compatibility'
import { useEntriesInRange } from '@/hooks/use-entries'
import { useFieldDefinitions, useHabits, useHabitStreaks } from '@/hooks/use-habits'
import { queryKeys } from '@/lib/query-keys'
import { todayISO } from '@/lib/dates'
import type { HabitWithFields } from '@/types/models'

type QueryOptions = { enabled?: boolean }

/** Family consistency ranking (shared habits only) for [start, end]. */
export function useFamilyLeaderboard(start: string, end: string, opts: QueryOptions = {}) {
  return useQuery({
    queryKey: queryKeys.family.leaderboard(start, end),
    queryFn: () => getFamilyLeaderboard(start, end),
    enabled: (opts.enabled ?? true) && !!start && !!end && start <= end,
  })
}

/** Raw daily numeric values of shared habits for [start, end]. */
export function useFamilyMetricSeries(start: string, end: string, opts: QueryOptions = {}) {
  return useQuery({
    queryKey: queryKeys.family.metrics(start, end),
    queryFn: () => getFamilyMetricSeries(start, end),
    enabled: (opts.enabled ?? true) && !!start && !!end && start <= end,
  })
}

/** Shared metrics grouped into fairly comparable metrics (same habit/field and unit). */
export function useComparableMetrics(start: string, end: string, opts: QueryOptions = {}) {
  const query = useFamilyMetricSeries(start, end, opts)
  const metrics = useMemo<ComparableMetric[] | undefined>(
    () => (query.data ? groupComparableMetrics(query.data) : undefined),
    [query.data],
  )
  return { ...query, metrics }
}

export type PersonalReportResult = {
  /** Habits offered in the habit filter: active ones plus archived ones with entries in range. */
  availableHabits: HabitWithFields[]
  report: PersonalReport<HabitWithFields> | undefined
  /** Best current streak among the reported habits (and the habit holding it). */
  bestStreak: { days: number; habit: HabitWithFields | null } | undefined
  isPending: boolean
  error: unknown
  refetch: () => void
}

/**
 * The signed-in member's own report for a range, optionally narrowed to one habit.
 * Entries are interpreted with the field definitions of their own habit version.
 */
export function usePersonalReport(period: DateRange, habitId: string | null): PersonalReportResult {
  const range = useMemo<DateRange>(() => ({ start: period.start, end: period.end }), [period.start, period.end])
  const habitsQuery = useHabits({ includeArchived: true })
  const entriesQuery = useEntriesInRange(range.start, range.end)

  const availableHabits = useMemo(
    () => (habitsQuery.data && entriesQuery.data ? habitsForReport(habitsQuery.data, entriesQuery.data, range) : []),
    [habitsQuery.data, entriesQuery.data, range],
  )
  const selected = useMemo(
    () => {
      // An unknown / no-longer-listed habit id falls back to all habits.
      const one = habitId ? availableHabits.filter((h) => h.id === habitId) : []
      return one.length ? one : availableHabits
    },
    [availableHabits, habitId],
  )
  const selectedIds = useMemo(() => selected.map((h) => h.id), [selected])
  const defsQuery = useFieldDefinitions(selectedIds)
  const streakIds = useMemo(() => selected.filter((h) => !h.archived_at).map((h) => h.id), [selected])
  const streaks = useHabitStreaks(streakIds)

  const report = useMemo(() => {
    if (!entriesQuery.data || !habitsQuery.data) return undefined
    if (selectedIds.length > 0 && !defsQuery.data) return undefined
    return buildPersonalReport({
      habits: selected,
      definitions: defsQuery.data ?? [],
      entries: entriesQuery.data,
      range,
      today: todayISO(),
    })
  }, [entriesQuery.data, habitsQuery.data, defsQuery.data, selected, selectedIds.length, range])

  const bestStreak = useMemo(() => {
    if (streaks.isPending && streakIds.length > 0) return undefined
    let best: { days: number; habit: HabitWithFields | null } = { days: 0, habit: null }
    for (const h of selected) {
      const current = streaks.data[h.id]?.current ?? 0
      if (current > best.days) best = { days: current, habit: h }
    }
    return best
  }, [streaks, streakIds.length, selected])

  const error = habitsQuery.error ?? entriesQuery.error ?? defsQuery.error
  return {
    availableHabits,
    report,
    bestStreak,
    isPending: !error && (habitsQuery.isPending || entriesQuery.isPending || (selectedIds.length > 0 && defsQuery.isPending)),
    error,
    refetch: () => {
      void habitsQuery.refetch()
      void entriesQuery.refetch()
      if (selectedIds.length) void defsQuery.refetch()
    },
  }
}
