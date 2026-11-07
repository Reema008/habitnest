-- HabitNest: enum types and shared utilities.
-- All objects live in `public`; privacy is enforced with RLS (see 0004).

create type public.habit_visibility as enum ('private', 'family');
create type public.field_type as enum ('number', 'text', 'radio', 'dropdown');
create type public.family_role as enum ('admin', 'member');
create type public.pet_type as enum ('kitty', 'bunny', 'teddy', 'dino', 'axolotl');
create type public.theme_mode as enum ('system', 'light', 'dark');
create type public.goal_operator as enum ('gte', 'lte', 'eq');
create type public.challenge_aggregation as enum ('sum', 'days_met');
create type public.reminder_kind as enum ('daily_reminder', 'incomplete_reminder');

-- Keeps updated_at current on every UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- True when `tz` is a valid IANA time zone name known to Postgres.
create or replace function public.is_valid_timezone(tz text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = tz);
$$;

-- Returns the current local date for a user, based on their profile time zone.
-- Defined in 0002 once profiles exists (see public.user_local_date).
