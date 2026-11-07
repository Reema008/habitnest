import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/errors'
import type { TablesInsert } from '@/types/database'
import type { ScheduleItem } from '@/types/models'

/** Columns the client may write (user_id defaults to auth.uid() on the server). */
export type ScheduleDraft = Pick<
  TablesInsert<'schedules'>,
  'day_of_week' | 'title' | 'description' | 'start_time' | 'end_time'
>

/** My whole weekly schedule (RLS: schedules are always personal). */
export async function listSchedules(userId: string): Promise<ScheduleItem[]> {
  return unwrap(
    await supabase
      .from('schedules')
      .select('*')
      .eq('user_id', userId)
      .order('day_of_week')
      .order('start_time')
      .order('end_time'),
  )
}

/** My schedule for one day of the week (0 = Sunday … 6 = Saturday). */
export async function listSchedulesForDay(userId: string, dayOfWeek: number): Promise<ScheduleItem[]> {
  return unwrap(
    await supabase
      .from('schedules')
      .select('*')
      .eq('user_id', userId)
      .eq('day_of_week', dayOfWeek)
      .order('start_time')
      .order('end_time'),
  )
}

/** Inserts one or more items (e.g. the same item on several days). */
export async function createScheduleItems(drafts: ScheduleDraft[]): Promise<ScheduleItem[]> {
  if (drafts.length === 0) return []
  return unwrap(await supabase.from('schedules').insert(drafts).select('*'))
}

export async function updateScheduleItem(id: string, patch: Partial<ScheduleDraft>): Promise<ScheduleItem> {
  return unwrap(await supabase.from('schedules').update(patch).eq('id', id).select('*').single())
}

export async function deleteScheduleItem(id: string): Promise<void> {
  unwrap(await supabase.from('schedules').delete().eq('id', id))
}
