import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createScheduleItems, deleteScheduleItem, listSchedules, listSchedulesForDay, updateScheduleItem, type ScheduleDraft,
} from '@/api/schedules'
import { queryKeys } from '@/lib/query-keys'
import { useCurrentUser } from '@/providers/auth-provider'

/** My whole weekly schedule. */
export function useSchedules() {
  const { userId } = useCurrentUser()
  return useQuery({ queryKey: [...queryKeys.schedules.all, 'week'], queryFn: () => listSchedules(userId) })
}

/** My schedule for one weekday (0 = Sunday … 6 = Saturday), e.g. today's plan on the dashboard. */
export function useDaySchedule(dayOfWeek: number) {
  const { userId } = useCurrentUser()
  return useQuery({
    queryKey: queryKeys.schedules.byDay(dayOfWeek),
    queryFn: () => listSchedulesForDay(userId, dayOfWeek),
  })
}

function useInvalidateSchedules() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: queryKeys.schedules.all })
}

/** Creates one or more schedule items (one per selected day). */
export function useCreateScheduleItems() {
  const invalidate = useInvalidateSchedules()
  return useMutation({
    mutationFn: (drafts: ScheduleDraft[]) => createScheduleItems(drafts),
    onSettled: invalidate,
  })
}

export function useUpdateScheduleItem() {
  const invalidate = useInvalidateSchedules()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ScheduleDraft> }) => updateScheduleItem(id, patch),
    onSettled: invalidate,
  })
}

export function useDeleteScheduleItem() {
  const invalidate = useInvalidateSchedules()
  return useMutation({
    mutationFn: (id: string) => deleteScheduleItem(id),
    onSettled: invalidate,
  })
}
