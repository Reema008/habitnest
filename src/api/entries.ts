/**
 * Habit entries. One entry per habit per day; the server validates values against the field
 * definitions of `habit_version` and computes `is_complete`.
 */
import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/errors'
import type { FieldValues, HabitEntry } from '@/types/models'

export async function listEntriesForDate(userId: string, date: string): Promise<HabitEntry[]> {
  return unwrap(await supabase.from('habit_entries').select('*').eq('user_id', userId).eq('entry_date', date))
}

/** The caller's own entries in a date range (inclusive), optionally for one habit. */
export async function listEntriesInRange(userId: string, start: string, end: string, habitId?: string): Promise<HabitEntry[]> {
  let q = supabase
    .from('habit_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('entry_date', start)
    .lte('entry_date', end)
    .order('entry_date')
  if (habitId) q = q.eq('habit_id', habitId)
  return unwrap(await q)
}

/** Entries of one habit (any owner the caller may see — RLS enforces privacy). */
export async function listEntriesForHabit(habitId: string, limit = 400): Promise<HabitEntry[]> {
  return unwrap(
    await supabase.from('habit_entries').select('*').eq('habit_id', habitId).order('entry_date', { ascending: false }).limit(limit),
  )
}

export type SaveEntryInput = {
  habitId: string
  date: string
  habitVersion: number
  values: FieldValues
  notes?: string | null
}

/** Creates or updates the entry for (habit, date). */
export async function saveEntry(input: SaveEntryInput): Promise<HabitEntry> {
  return unwrap(
    await supabase
      .from('habit_entries')
      .upsert(
        {
          habit_id: input.habitId,
          entry_date: input.date,
          habit_version: input.habitVersion,
          field_values: input.values,
          notes: input.notes ?? null,
        },
        { onConflict: 'habit_id,entry_date' },
      )
      .select('*')
      .single(),
  )
}

export async function deleteEntry(id: string): Promise<void> {
  unwrap(await supabase.from('habit_entries').delete().eq('id', id))
}
