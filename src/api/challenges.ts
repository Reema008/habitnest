/**
 * Family challenges. RLS limits reads to the caller's family; creators/admins may edit or delete,
 * and participants can only add/change/remove their own participation with a *shared* habit
 * (validated again by a trigger). Progress comes from the SECURITY INVOKER `challenge_progress` RPC.
 */
import { supabase } from '@/lib/supabase'
import { unwrap, unwrapMaybe } from '@/lib/errors'
import type { TablesInsert, TablesUpdate } from '@/types/database'
import type { ChallengeParticipant, FamilyChallenge } from '@/types/models'

/** Every challenge of my family, newest first. */
export async function listChallenges(): Promise<FamilyChallenge[]> {
  return unwrap(
    await supabase.from('family_challenges').select('*').order('start_date', { ascending: false }).order('created_at', { ascending: false }),
  )
}

export async function getChallenge(id: string): Promise<FamilyChallenge | null> {
  return unwrapMaybe(await supabase.from('family_challenges').select('*').eq('id', id).maybeSingle())
}

/** Fields a client may send when creating a challenge (created_by is set server-side). */
export type NewChallenge = Pick<
  TablesInsert<'family_challenges'>,
  'family_id' | 'title' | 'description' | 'metric_label' | 'unit' | 'aggregation' | 'target' | 'start_date' | 'end_date'
>

export async function createChallenge(input: NewChallenge): Promise<FamilyChallenge> {
  return unwrap(
    await supabase
      .from('family_challenges')
      .insert({
        family_id: input.family_id,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        metric_label: input.metric_label.trim(),
        unit: input.unit?.trim() || null,
        aggregation: input.aggregation,
        target: input.target,
        start_date: input.start_date,
        end_date: input.end_date,
      })
      .select('*')
      .single(),
  )
}

export type ChallengeUpdate = Pick<TablesUpdate<'family_challenges'>, 'title' | 'description' | 'target' | 'start_date' | 'end_date'>

export async function updateChallenge(id: string, patch: ChallengeUpdate): Promise<FamilyChallenge> {
  const clean: ChallengeUpdate = { ...patch }
  if (clean.title !== undefined) clean.title = clean.title.trim()
  if (clean.description !== undefined) clean.description = clean.description?.trim() || null
  return unwrap(await supabase.from('family_challenges').update(clean).eq('id', id).select('*').single())
}

export async function deleteChallenge(id: string): Promise<void> {
  unwrap(await supabase.from('family_challenges').delete().eq('id', id))
}

/** Participants (user + linked habit) of one challenge. */
export async function listParticipants(challengeId: string): Promise<ChallengeParticipant[]> {
  return unwrap(await supabase.from('challenge_participants').select('*').eq('challenge_id', challengeId).order('joined_at'))
}

/** My participations across all of my family's challenges. */
export async function listMyParticipations(userId: string): Promise<ChallengeParticipant[]> {
  return unwrap(await supabase.from('challenge_participants').select('*').eq('user_id', userId))
}

export type JoinChallengeInput = { challengeId: string; habitId: string; fieldKey: string | null }

export async function joinChallenge(input: JoinChallengeInput): Promise<ChallengeParticipant> {
  return unwrap(
    await supabase
      .from('challenge_participants')
      .insert({ challenge_id: input.challengeId, habit_id: input.habitId, field_key: input.fieldKey })
      .select('*')
      .single(),
  )
}

/** Links a different habit/field to my participation. */
export async function changeChallengeHabit(participantId: string, habitId: string, fieldKey: string | null): Promise<ChallengeParticipant> {
  return unwrap(
    await supabase
      .from('challenge_participants')
      .update({ habit_id: habitId, field_key: fieldKey })
      .eq('id', participantId)
      .select('*')
      .single(),
  )
}

export async function leaveChallenge(participantId: string): Promise<void> {
  unwrap(await supabase.from('challenge_participants').delete().eq('id', participantId))
}

export type ChallengeProgress = {
  userId: string
  displayName: string
  avatarUrl: string | null
  avatarPreset: string | null
  habitId: string | null
  habitName: string | null
  progress: number
  target: number
  percent: number
}

/** Progress of every participant (shared habits only), ordered by progress. */
export async function getChallengeProgress(challengeId: string): Promise<ChallengeProgress[]> {
  const rows = unwrap(await supabase.rpc('challenge_progress', { p_challenge_id: challengeId }))
  return rows
    .filter((r): r is typeof r & { user_id: string } => !!r.user_id)
    .map((r) => ({
      userId: r.user_id,
      displayName: r.display_name ?? 'Family member',
      avatarUrl: r.avatar_url,
      avatarPreset: r.avatar_preset,
      habitId: r.habit_id,
      habitName: r.habit_name,
      progress: Number(r.progress ?? 0),
      target: Number(r.target ?? 0),
      percent: Number(r.percent ?? 0),
    }))
}
