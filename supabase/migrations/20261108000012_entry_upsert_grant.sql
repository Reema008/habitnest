-- HabitNest: allow PostgREST upserts on habit_entries.
-- `upsert(..., { onConflict: 'habit_id,entry_date' })` issues ON CONFLICT DO UPDATE SET for every
-- supplied column, including the conflict columns, so the client needs UPDATE on them.
-- Changing their values is still rejected by the habit_entries_before_write trigger.
grant update (habit_id, entry_date) on public.habit_entries to authenticated;
