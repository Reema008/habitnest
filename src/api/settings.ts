/**
 * Per-user settings (theme + reminder schedule). The row is created by the sign-up trigger;
 * users may only update the columns granted in the core migration.
 */
import { supabase } from '@/lib/supabase'
import { AppError, unwrap, unwrapMaybe } from '@/lib/errors'
import type { TablesUpdate } from '@/types/database'
import type { UserSettings } from '@/types/models'

export type SettingsUpdate = Pick<
  TablesUpdate<'user_settings'>,
  | 'theme_mode'
  | 'daily_reminder_enabled'
  | 'daily_reminder_time'
  | 'incomplete_reminder_enabled'
  | 'incomplete_reminder_time'
>

export async function getMySettings(userId: string): Promise<UserSettings> {
  const row = unwrapMaybe(await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle())
  if (!row) throw new AppError('Your settings could not be found. Please sign out and sign in again.')
  return row
}

export async function updateMySettings(userId: string, patch: SettingsUpdate): Promise<UserSettings> {
  return unwrap(await supabase.from('user_settings').update(patch).eq('user_id', userId).select('*').single())
}
