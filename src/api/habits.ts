/**
 * Habits data access. Field definitions are versioned: a habit's *current* fields are those with
 * version = habits.current_version; older versions remain so historical entries stay readable.
 */
import { supabase } from '@/lib/supabase'
import { unwrap, unwrapMaybe } from '@/lib/errors'
import type { TablesUpdate } from '@/types/database'
import type { FieldDefinition, FieldDraft, GoalDraft, Habit, HabitWithFields, HabitVisibility } from '@/types/models'

function attachCurrentFields(habits: Habit[], defs: FieldDefinition[]): HabitWithFields[] {
  return habits.map((h) => ({
    ...h,
    fields: defs
      .filter((d) => d.habit_id === h.id && d.version === h.current_version)
      .sort((a, b) => a.sort_order - b.sort_order),
  }))
}

/** The caller's own habits with their current fields (RLS also returns family-shared habits, so filter by owner). */
export async function listMyHabits(userId: string, opts: { includeArchived?: boolean } = {}): Promise<HabitWithFields[]> {
  let q = supabase.from('habits').select('*').eq('owner_id', userId).order('sort_order').order('created_at')
  if (!opts.includeArchived) q = q.is('archived_at', null)
  const habits = unwrap(await q)
  if (!habits.length) return []
  const defs = await listFieldDefinitions(habits.map((h) => h.id))
  return attachCurrentFields(habits, defs)
}

/** Habits shared with the family by *other* members (RLS guarantees only shared ones are returned). */
export async function listSharedFamilyHabits(userId: string): Promise<HabitWithFields[]> {
  const habits = unwrap(
    await supabase.from('habits').select('*').neq('owner_id', userId).eq('visibility', 'family').is('archived_at', null).order('name'),
  )
  if (!habits.length) return []
  const defs = await listFieldDefinitions(habits.map((h) => h.id))
  return attachCurrentFields(habits, defs)
}

export async function getHabit(id: string): Promise<HabitWithFields | null> {
  const habit = unwrapMaybe(await supabase.from('habits').select('*').eq('id', id).maybeSingle())
  if (!habit) return null
  const defs = await listFieldDefinitions([id])
  return attachCurrentFields([habit], defs)[0]!
}

/** All field definitions (every version) for the given habits. */
export async function listFieldDefinitions(habitIds: string[]): Promise<FieldDefinition[]> {
  if (!habitIds.length) return []
  return unwrap(
    await supabase
      .from('habit_field_definitions')
      .select('*')
      .in('habit_id', habitIds)
      .order('version')
      .order('sort_order'),
  )
}

export type HabitDraftMeta = {
  name: string
  description?: string | null
  icon: string
  color: string
  visibility: HabitVisibility
  notes_enabled: boolean
  frequency_days: number[]
}

export async function createHabit(meta: HabitDraftMeta, fields: FieldDraft[], goal: GoalDraft): Promise<string> {
  return unwrap(
    await supabase.rpc('create_habit', {
      p_habit: meta,
      p_fields: fields,
      p_goal: goal ?? undefined,
    }),
  )
}

/** Saves fields (creating a new version only if they changed) and the goal. Returns the current version. */
export async function saveHabitFields(habitId: string, fields: FieldDraft[], goal: GoalDraft): Promise<number> {
  return unwrap(
    await supabase.rpc('save_habit_fields', {
      p_habit_id: habitId,
      p_fields: fields,
      p_goal: goal ?? undefined,
    }),
  )
}

export type HabitMetaUpdate = Pick<
  TablesUpdate<'habits'>,
  'name' | 'description' | 'icon' | 'color' | 'visibility' | 'notes_enabled' | 'frequency_days' | 'sort_order' | 'archived_at'
>

export async function updateHabit(id: string, patch: HabitMetaUpdate): Promise<Habit> {
  return unwrap(await supabase.from('habits').update(patch).eq('id', id).select('*').single())
}

export async function deleteHabit(id: string): Promise<void> {
  unwrap(await supabase.from('habits').delete().eq('id', id))
}

/** Persists a new order for the caller's habits. */
export async function reorderHabits(orderedIds: string[]): Promise<void> {
  await Promise.all(orderedIds.map((id, i) => supabase.from('habits').update({ sort_order: i }).eq('id', id).then(unwrap)))
}

export async function getHabitStreak(habitId: string): Promise<{ current: number; best: number }> {
  const rows = unwrap(await supabase.rpc('habit_streak', { p_habit_id: habitId }))
  const r = rows?.[0]
  return { current: r?.current_streak ?? 0, best: r?.best_streak ?? 0 }
}
