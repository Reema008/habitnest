-- HabitNest: security helper functions used by RLS policies.
-- SECURITY DEFINER so they can read membership without triggering recursive RLS;
-- each one only ever answers questions about the *calling* user (auth.uid()).

create or replace function public.my_family_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select fm.family_id
  from public.family_members fm
  where fm.user_id = (select auth.uid());
$$;

create or replace function public.is_family_admin(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.family_members fm
    where fm.family_id = p_family_id
      and fm.user_id = (select auth.uid())
      and fm.role = 'admin'
  );
$$;

-- True when the caller and p_user are members of the same family (and are different people).
create or replace function public.shares_family_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user is not null
     and p_user <> (select auth.uid())
     and exists (
       select 1
       from public.family_members me
       join public.family_members other on other.family_id = me.family_id
       where me.user_id = (select auth.uid())
         and other.user_id = p_user
     );
$$;

-- The single source of truth for "may the caller see this habit and its data?"
-- Owner always; family members only when the owner explicitly shared it.
create or replace function public.can_view_habit(p_habit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.habits h
    where h.id = p_habit_id
      and (
        h.owner_id = (select auth.uid())
        or (h.visibility = 'family' and public.shares_family_with(h.owner_id))
      )
  );
$$;

-- Local "today" for a user, using their profile time zone (falls back to UTC).
create or replace function public.user_local_date(p_user uuid, p_at timestamptz default now())
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (p_at at time zone coalesce(
            (select p.timezone from public.profiles p where p.id = p_user), 'UTC'))::date;
$$;

revoke execute on function public.my_family_id() from public, anon;
revoke execute on function public.is_family_admin(uuid) from public, anon;
revoke execute on function public.shares_family_with(uuid) from public, anon;
revoke execute on function public.can_view_habit(uuid) from public, anon;
revoke execute on function public.user_local_date(uuid, timestamptz) from public, anon;
grant execute on function public.my_family_id() to authenticated;
grant execute on function public.is_family_admin(uuid) to authenticated;
grant execute on function public.shares_family_with(uuid) to authenticated;
grant execute on function public.can_view_habit(uuid) to authenticated;
-- user_local_date is internal (used by SECURITY DEFINER triggers and server jobs) and not granted to clients.
