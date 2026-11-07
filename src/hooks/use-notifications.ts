import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  countUnreadNotifications, deleteNotification, listNotifications, markAllNotificationsRead, markNotificationRead,
} from '@/api/notifications'
import { AppError } from '@/lib/errors'
import { queryKeys } from '@/lib/query-keys'
import { useAuth } from '@/providers/auth-provider'
import type { AppNotification } from '@/types/models'

const listKey = [...queryKeys.notifications.all, 'list'] as const
const unreadKey = [...queryKeys.notifications.all, 'unread'] as const

/** My notifications, newest first. */
export function useNotifications() {
  const { userId } = useAuth()
  return useQuery({
    queryKey: listKey,
    queryFn: () => listNotifications(userId!),
    enabled: !!userId,
  })
}

/** Number of unread notifications (0 while loading, signed out or on error). Refreshes every minute. */
export function useUnreadCount(): number {
  const { userId } = useAuth()
  const { data } = useQuery({
    queryKey: unreadKey,
    queryFn: () => countUnreadNotifications(userId!),
    enabled: !!userId,
    refetchInterval: 60_000,
  })
  return data ?? 0
}

/** Applies a local change to the cached list and unread count; returns a rollback. */
function useOptimisticNotifications() {
  const qc = useQueryClient()
  return async (change: (list: AppNotification[]) => AppNotification[]) => {
    await qc.cancelQueries({ queryKey: queryKeys.notifications.all })
    const prevList = qc.getQueryData<AppNotification[]>(listKey)
    const prevUnread = qc.getQueryData<number>(unreadKey)
    if (prevList) {
      const next = change(prevList)
      qc.setQueryData(listKey, next)
      // The list may be capped, so only adjust the count by the observed difference.
      const delta = prevList.filter((n) => !n.read_at).length - next.filter((n) => !n.read_at).length
      if (prevUnread !== undefined) qc.setQueryData(unreadKey, Math.max(0, prevUnread - delta))
    }
    return () => {
      if (prevList) qc.setQueryData(listKey, prevList)
      if (prevUnread !== undefined) qc.setQueryData(unreadKey, prevUnread)
    }
  }
}

type Rollback = { rollback: () => void }

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  const optimistic = useOptimisticNotifications()
  return useMutation<void, Error, string, Rollback>({
    mutationFn: (id) => markNotificationRead(id),
    onMutate: async (id) => {
      const now = new Date().toISOString()
      return { rollback: await optimistic((list) => list.map((n) => (n.id === id && !n.read_at ? { ...n, read_at: now } : n))) }
    },
    onError: (_e, _id, ctx) => ctx?.rollback(),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  })
}

export function useMarkAllNotificationsRead() {
  const { userId } = useAuth()
  const qc = useQueryClient()
  const optimistic = useOptimisticNotifications()
  return useMutation<void, Error, void, Rollback>({
    mutationFn: () => {
      if (!userId) throw new AppError('Please sign in again.')
      return markAllNotificationsRead(userId)
    },
    onMutate: async () => {
      const now = new Date().toISOString()
      const rollback = await optimistic((list) => list.map((n) => (n.read_at ? n : { ...n, read_at: now })))
      qc.setQueryData(unreadKey, 0)
      return { rollback }
    },
    onError: (_e, _v, ctx) => ctx?.rollback(),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  })
}

export function useDeleteNotification() {
  const qc = useQueryClient()
  const optimistic = useOptimisticNotifications()
  return useMutation<void, Error, string, Rollback>({
    mutationFn: (id) => deleteNotification(id),
    onMutate: async (id) => ({ rollback: await optimistic((list) => list.filter((n) => n.id !== id)) }),
    onError: (_e, _id, ctx) => ctx?.rollback(),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  })
}
