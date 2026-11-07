import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/errors'
import type { Achievement, UserAchievement } from '@/types/models'

export async function listAchievementCatalogue(): Promise<Achievement[]> {
  return unwrap(await supabase.from('achievements').select('*').order('sort_order'))
}

/** Badges earned by a user. For family members, RLS hides badges tied to their private habits. */
export async function listUserAchievements(userId: string): Promise<UserAchievement[]> {
  return unwrap(
    await supabase.from('user_achievements').select('*').eq('user_id', userId).order('earned_at', { ascending: false }),
  )
}
