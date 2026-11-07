import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteEntry, listEntriesForDate, listEntriesForHabit, listEntriesInRange, saveEntry, type SaveEntryInput } from '@/api/entries'
import { queryKeys } from '@/lib/query-keys'
import { useCurrentUser } from '@/providers/auth-provider'

export function useEntriesForDate(date: string) {
  const { userId } = useCurrentUser()
  return useQuery({ queryKey: queryKeys.entries.byDate(date), queryFn: () => listEntriesForDate(userId, date) })
}

/** My entries in [start, end] (inclusive), optionally for one habit. */
export function useEntriesInRange(start: string, end: string, habitId?: string) {
  const { userId } = useCurrentUser()
  return useQuery({
    queryKey: queryKeys.entries.range(start, end, habitId),
    queryFn: () => listEntriesInRange(userId, start, end, habitId),
    enabled: !!start && !!end && start <= end,
  })
}

/** Entries for a single habit (mine, or a family member's shared habit). */
export function useHabitEntries(habitId: string | undefined) {
  return useQuery({
    queryKey: [...queryKeys.entries.all, 'habit', habitId],
    queryFn: () => listEntriesForHabit(habitId!),
    enabled: !!habitId,
  })
}

function useInvalidateEntries() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.entries.all }),
      qc.invalidateQueries({ queryKey: queryKeys.habits.streaks }),
      qc.invalidateQueries({ queryKey: queryKeys.achievements.all }),
      qc.invalidateQueries({ queryKey: queryKeys.family.all }),
      qc.invalidateQueries({ queryKey: queryKeys.challenges.all }),
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
    ])
}

export function useSaveEntry() {
  const invalidate = useInvalidateEntries()
  return useMutation({ mutationFn: (input: SaveEntryInput) => saveEntry(input), onSuccess: invalidate })
}

export function useDeleteEntry() {
  const invalidate = useInvalidateEntries()
  return useMutation({ mutationFn: (id: string) => deleteEntry(id), onSuccess: invalidate })
}
