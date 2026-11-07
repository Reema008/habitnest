import { useMemo } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createHabit, deleteHabit, getHabit, getHabitStreak, listFieldDefinitions, listMyHabits, listSharedFamilyHabits,
  reorderHabits, saveHabitFields, updateHabit, type HabitDraftMeta, type HabitMetaUpdate,
} from '@/api/habits'
import { queryKeys } from '@/lib/query-keys'
import { useCurrentUser } from '@/providers/auth-provider'
import type { FieldDraft, GoalDraft } from '@/types/models'

/** My habits (current fields). */
export function useHabits(opts: { includeArchived?: boolean } = {}) {
  const { userId } = useCurrentUser()
  return useQuery({
    queryKey: queryKeys.habits.list(!!opts.includeArchived),
    queryFn: () => listMyHabits(userId, opts),
  })
}

/** My non-archived habits. */
export function useActiveHabits() {
  return useHabits({ includeArchived: false })
}

export function useHabit(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.habits.detail(id ?? ''),
    queryFn: () => getHabit(id!),
    enabled: !!id,
  })
}

/** Field definitions for all versions of the given habits (for rendering historical entries / reports). */
export function useFieldDefinitions(habitIds: string[]) {
  const sorted = useMemo(() => [...habitIds].sort(), [habitIds])
  return useQuery({
    queryKey: [...queryKeys.habits.all, 'fields', sorted],
    queryFn: () => listFieldDefinitions(sorted),
    enabled: sorted.length > 0,
  })
}

/** Habits other family members share with me. */
export function useSharedFamilyHabits() {
  const { userId } = useCurrentUser()
  return useQuery({ queryKey: queryKeys.habits.shared, queryFn: () => listSharedFamilyHabits(userId) })
}

/** Current and best streak per habit id. */
export function useHabitStreaks(habitIds: string[]) {
  const results = useQueries({
    queries: habitIds.map((id) => ({
      queryKey: [...queryKeys.habits.streaks, id],
      queryFn: () => getHabitStreak(id),
      staleTime: 60_000,
    })),
  })
  return useMemo(() => {
    const map: Record<string, { current: number; best: number }> = {}
    habitIds.forEach((id, i) => {
      const d = results[i]?.data
      if (d) map[id] = d
    })
    return { data: map, isPending: results.some((r) => r.isPending) }
  }, [habitIds, results])
}

function useInvalidateHabits() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.habits.all }),
      qc.invalidateQueries({ queryKey: queryKeys.entries.all }),
      qc.invalidateQueries({ queryKey: queryKeys.family.all }),
      qc.invalidateQueries({ queryKey: queryKeys.challenges.all }),
      qc.invalidateQueries({ queryKey: queryKeys.achievements.all }),
    ])
}

export function useCreateHabit() {
  const invalidate = useInvalidateHabits()
  return useMutation({
    mutationFn: (v: { meta: HabitDraftMeta; fields: FieldDraft[]; goal: GoalDraft }) => createHabit(v.meta, v.fields, v.goal),
    onSuccess: invalidate,
  })
}

export function useSaveHabitFields() {
  const invalidate = useInvalidateHabits()
  return useMutation({
    mutationFn: (v: { habitId: string; fields: FieldDraft[]; goal: GoalDraft }) => saveHabitFields(v.habitId, v.fields, v.goal),
    onSuccess: invalidate,
  })
}

export function useUpdateHabit() {
  const invalidate = useInvalidateHabits()
  return useMutation({
    mutationFn: (v: { id: string; patch: HabitMetaUpdate }) => updateHabit(v.id, v.patch),
    onSuccess: invalidate,
  })
}

export function useDeleteHabit() {
  const invalidate = useInvalidateHabits()
  return useMutation({ mutationFn: (id: string) => deleteHabit(id), onSuccess: invalidate })
}

export function useReorderHabits() {
  const invalidate = useInvalidateHabits()
  return useMutation({ mutationFn: (ids: string[]) => reorderHabits(ids), onSuccess: invalidate })
}
