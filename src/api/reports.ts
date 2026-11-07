/**
 * Family reporting RPCs. Both are SECURITY INVOKER and only include habits members chose to share
 * (visibility = 'family'); private habits never reach these results.
 */
import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/errors'
import type { Database } from '@/types/database'
import type { MetricSeriesRow } from '@/domain/metric-compatibility'

type LeaderboardRpcRow = Database['public']['Functions']['family_leaderboard']['Returns'][number]

export type LeaderboardRow = {
  userId: string
  displayName: string
  avatarUrl: string | null
  avatarPreset: string | null
  sharedHabits: number
  scheduledDays: number
  completedDays: number
  /** 0–100 (one decimal), or null when nothing shared was scheduled in the period. */
  consistency: number | null
  bestCurrentStreak: number
}

function toLeaderboardRow(r: LeaderboardRpcRow): LeaderboardRow | null {
  if (!r.user_id) return null
  return {
    userId: r.user_id,
    displayName: r.display_name ?? 'Family member',
    avatarUrl: r.avatar_url,
    avatarPreset: r.avatar_preset,
    sharedHabits: r.shared_habits ?? 0,
    scheduledDays: r.scheduled_days ?? 0,
    completedDays: r.completed_days ?? 0,
    consistency: r.consistency === null ? null : Number(r.consistency),
    bestCurrentStreak: r.best_current_streak ?? 0,
  }
}

/** Consistency of every family member's shared habits between start and end (inclusive). */
export async function getFamilyLeaderboard(start: string, end: string): Promise<LeaderboardRow[]> {
  const rows = unwrap(await supabase.rpc('family_leaderboard', { p_start: start, p_end: end }))
  return rows.map(toLeaderboardRow).filter((r): r is LeaderboardRow => r !== null)
}

/** Daily numeric values of every member's shared habits between start and end (inclusive). */
export async function getFamilyMetricSeries(start: string, end: string): Promise<MetricSeriesRow[]> {
  const rows = unwrap(await supabase.rpc('family_metric_series', { p_start: start, p_end: end }))
  return rows.map((r) => ({ ...r, value: r.value === null ? null : Number(r.value) }))
}
