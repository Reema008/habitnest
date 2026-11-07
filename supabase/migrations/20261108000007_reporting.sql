-- HabitNest: family reporting functions.
-- All are SECURITY INVOKER: Row Level Security filters rows *before* aggregation, so private
-- data cannot leak through totals or rankings. They additionally restrict to
-- visibility = 'family' habits, so even the caller's own private habits never influence
-- family comparisons (a rank built on private data would itself reveal private progress).

create or replace function public.family_leaderboard(p_start date, p_end date)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  avatar_preset text,
  shared_habits integer,
  scheduled_days integer,
  completed_days integer,
  consistency numeric,
  best_current_streak integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with members as (
    select fm.user_id from public.family_members fm
     where fm.family_id = public.my_family_id()
  ),
  shared as (
    select h.id, h.owner_id, h.frequency_days,
           (h.created_at at time zone coalesce(p.timezone, 'UTC'))::date as created_local,
           (now() at time zone coalesce(p.timezone, 'UTC'))::date as today_local
      from public.habits h
      join members m on m.user_id = h.owner_id
      left join public.profiles p on p.id = h.owner_id
     where h.visibility = 'family' and h.archived_at is null
  ),
  sched as (
    select s.id as habit_id, s.owner_id, g::date as d
      from shared s
     cross join lateral generate_series(
       greatest(p_start, s.created_local), least(p_end, s.today_local), interval '1 day') g
     where extract(dow from g)::smallint = any (s.frequency_days)
  ),
  agg as (
    select sc.owner_id,
           count(*)::int as scheduled_days,
           count(e.id) filter (where e.is_complete)::int as completed_days
      from sched sc
      left join public.habit_entries e on e.habit_id = sc.habit_id and e.entry_date = sc.d
     group by sc.owner_id
  ),
  streaks as (
    select s.owner_id, max(st.current_streak)::int as best_current_streak
      from shared s cross join lateral public.habit_streak(s.id) st
     group by s.owner_id
  )
  select m.user_id, p.display_name, p.avatar_url, p.avatar_preset,
         (select count(*)::int from shared s where s.owner_id = m.user_id),
         coalesce(a.scheduled_days, 0),
         coalesce(a.completed_days, 0),
         case when coalesce(a.scheduled_days, 0) = 0 then null
              else round(a.completed_days::numeric / a.scheduled_days * 100, 1) end,
         coalesce(st.best_current_streak, 0)
    from members m
    join public.profiles p on p.id = m.user_id
    left join agg a on a.owner_id = m.user_id
    left join streaks st on st.owner_id = m.user_id
   order by 8 desc nulls last, 7 desc, p.display_name;
$$;

-- Daily numeric values of shared habits for every family member, one row per value.
-- The client groups rows into compatible metrics (same template/name and same unit).
create or replace function public.family_metric_series(p_start date, p_end date)
returns table (
  user_id uuid,
  habit_id uuid,
  habit_name text,
  template_key text,
  field_key text,
  field_label text,
  unit text,
  entry_date date,
  value numeric,
  is_complete boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.user_id, h.id, h.name, h.template_key, d.field_key, d.label, d.unit,
         e.entry_date, (e.field_values ->> d.field_key)::numeric, e.is_complete
    from public.habits h
    join public.family_members fm on fm.user_id = h.owner_id and fm.family_id = public.my_family_id()
    join public.habit_entries e on e.habit_id = h.id and e.entry_date between p_start and p_end
    join public.habit_field_definitions d
      on d.habit_id = h.id and d.version = e.habit_version and d.field_type = 'number'
   where h.visibility = 'family'
     and e.field_values ? d.field_key
     and p_end - p_start <= 400
   order by e.entry_date;
$$;

create or replace function public.challenge_progress(p_challenge_id uuid)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  avatar_preset text,
  habit_id uuid,
  habit_name text,
  progress numeric,
  target numeric,
  percent numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select cp.user_id, p.display_name, p.avatar_url, p.avatar_preset, h.id, h.name,
         case when c.aggregation = 'sum' then
                coalesce(sum((e.field_values ->> cp.field_key)::numeric)
                         filter (where d.field_type = 'number'
                                   and lower(coalesce(d.unit, '')) = lower(coalesce(c.unit, ''))), 0)
              else count(distinct e.entry_date) filter (where e.is_complete)
         end as progress,
         c.target,
         least(100, round(
           (case when c.aggregation = 'sum' then
                   coalesce(sum((e.field_values ->> cp.field_key)::numeric)
                            filter (where d.field_type = 'number'
                                      and lower(coalesce(d.unit, '')) = lower(coalesce(c.unit, ''))), 0)
                 else count(distinct e.entry_date) filter (where e.is_complete)
            end) / c.target * 100, 1)) as percent
    from public.family_challenges c
    join public.challenge_participants cp on cp.challenge_id = c.id
    join public.profiles p on p.id = cp.user_id
    -- Only shared habits contribute; RLS hides anything else regardless.
    left join public.habits h on h.id = cp.habit_id and h.visibility = 'family'
    left join public.habit_entries e
      on e.habit_id = h.id and e.entry_date between c.start_date and c.end_date
    left join public.habit_field_definitions d
      on d.habit_id = h.id and d.version = e.habit_version and d.field_key = cp.field_key
   where c.id = p_challenge_id
   group by cp.user_id, p.display_name, p.avatar_url, p.avatar_preset, h.id, h.name,
            c.aggregation, c.target
   order by 7 desc, p.display_name;
$$;
