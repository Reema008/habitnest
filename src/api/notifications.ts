/**
 * In-app notifications (rows are created server-side: badges, challenges, password resets, …).
 * Users can read, mark read (read_at only) and delete their own rows.
 */
import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/errors'
import type { AppNotification } from '@/types/models'

export const NOTIFICATIONS_PAGE_SIZE = 100

export async function listNotifications(userId: string, limit = NOTIFICATIONS_PAGE_SIZE): Promise<AppNotification[]> {
  return unwrap(
    await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit),
  )
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)
  unwrap({ data: true, error })
  return count ?? 0
}

export async function markNotificationRead(id: string): Promise<void> {
  unwrap(await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null))
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  unwrap(
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null),
  )
}

export async function deleteNotification(id: string): Promise<void> {
  unwrap(await supabase.from('notifications').delete().eq('id', id))
}
