-- HabitNest: Row Level Security policies.
-- Principles:
--   * Every policy targets `authenticated` only; `anon` can read nothing.
--   * Private data is filtered here, in the database, never only in the UI.
--   * Writes are always restricted to the caller's own rows (plus admin actions on family rows).
-- Tables without policies (family_join_attempts, reminder_deliveries, admin_password_resets)
-- are server-only.

-- profiles ------------------------------------------------------------------
create policy profiles_select_self_or_family on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_family_with(id));

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- user_settings ---------------------------------------------------------------
create policy user_settings_select_self on public.user_settings
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy user_settings_update_self on public.user_settings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- families ------------------------------------------------------------------
create policy families_select_member on public.families
  for select to authenticated
  using (id = public.my_family_id());

create policy families_update_admin on public.families
  for update to authenticated
  using (public.is_family_admin(id))
  with check (public.is_family_admin(id));

create policy families_delete_admin on public.families
  for delete to authenticated
  using (public.is_family_admin(id));

-- family_members ------------------------------------------------------------
create policy family_members_select_same_family on public.family_members
  for select to authenticated
  using (family_id = public.my_family_id());

create policy family_members_update_admin on public.family_members
  for update to authenticated
  using (public.is_family_admin(family_id))
  with check (public.is_family_admin(family_id));

-- A member may leave (delete own row); an admin may remove members of their family.
create policy family_members_delete_self_or_admin on public.family_members
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_family_admin(family_id));

-- family_invitations (admins only; joining goes through join_family RPC) -----
create policy family_invitations_select_admin on public.family_invitations
  for select to authenticated
  using (public.is_family_admin(family_id));

create policy family_invitations_update_admin on public.family_invitations
  for update to authenticated
  using (public.is_family_admin(family_id))
  with check (public.is_family_admin(family_id));

-- habits --------------------------------------------------------------------
create policy habits_select_owner_or_shared on public.habits
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or (visibility = 'family' and public.shares_family_with(owner_id))
  );

create policy habits_update_owner on public.habits
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy habits_delete_owner on public.habits
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- habit_field_definitions (read-only for clients; written by RPCs) -----------
create policy habit_fields_select_visible on public.habit_field_definitions
  for select to authenticated
  using (public.can_view_habit(habit_id));

-- habit_entries -------------------------------------------------------------
create policy habit_entries_select_visible on public.habit_entries
  for select to authenticated
  using (user_id = (select auth.uid()) or public.can_view_habit(habit_id));

create policy habit_entries_insert_owner on public.habit_entries
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.habits h
                where h.id = habit_id and h.owner_id = (select auth.uid()))
  );

create policy habit_entries_update_owner on public.habit_entries
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.habits h
                where h.id = habit_id and h.owner_id = (select auth.uid()))
  );

create policy habit_entries_delete_owner on public.habit_entries
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- schedules (always personal) -------------------------------------------------
create policy schedules_select_owner on public.schedules
  for select to authenticated using (user_id = (select auth.uid()));
create policy schedules_insert_owner on public.schedules
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy schedules_update_owner on public.schedules
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy schedules_delete_owner on public.schedules
  for delete to authenticated using (user_id = (select auth.uid()));

-- achievements ----------------------------------------------------------------
create policy achievements_select_all on public.achievements
  for select to authenticated using (true);

-- Badges tied to a habit are only visible to family when that habit is visible to them,
-- so private habit progress is never revealed through badges.
create policy user_achievements_select on public.user_achievements
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (public.shares_family_with(user_id)
        and (habit_id is null or public.can_view_habit(habit_id)))
  );

-- family_challenges -----------------------------------------------------------
create policy family_challenges_select_member on public.family_challenges
  for select to authenticated
  using (family_id = public.my_family_id());

create policy family_challenges_insert_member on public.family_challenges
  for insert to authenticated
  with check (family_id = public.my_family_id() and created_by = (select auth.uid()));

create policy family_challenges_update_creator_or_admin on public.family_challenges
  for update to authenticated
  using (family_id = public.my_family_id()
         and (created_by = (select auth.uid()) or public.is_family_admin(family_id)))
  with check (family_id = public.my_family_id());

create policy family_challenges_delete_creator_or_admin on public.family_challenges
  for delete to authenticated
  using (family_id = public.my_family_id()
         and (created_by = (select auth.uid()) or public.is_family_admin(family_id)));

-- challenge_participants ------------------------------------------------------
create policy challenge_participants_select_member on public.challenge_participants
  for select to authenticated
  using (exists (select 1 from public.family_challenges c
                 where c.id = challenge_id and c.family_id = public.my_family_id()));

create policy challenge_participants_insert_self on public.challenge_participants
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.family_challenges c
                where c.id = challenge_id and c.family_id = public.my_family_id())
  );

create policy challenge_participants_update_self on public.challenge_participants
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy challenge_participants_delete_self on public.challenge_participants
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- notifications -----------------------------------------------------------------
create policy notifications_select_self on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update_self on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete_self on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));

-- push_subscriptions (inserted via register_push_subscription RPC) ---------------
create policy push_subscriptions_select_self on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy push_subscriptions_delete_self on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));
