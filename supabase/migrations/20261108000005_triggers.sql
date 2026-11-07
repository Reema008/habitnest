-- HabitNest: triggers for new users, entry validation, achievements and family events.

-- ===========================================================================
-- Internal: write field definitions for a habit version (validates input).
-- p_fields: [{field_key,label,field_type,unit,options[],required,validation{}}]
-- ===========================================================================
create or replace function public._write_field_version(p_habit_id uuid, p_version integer, p_fields jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  f jsonb;
  i integer := 0;
  v_type public.field_type;
  v_options text[];
  v_validation jsonb;
  v_keys text[] := '{}';
  v_key text;
begin
  if jsonb_typeof(p_fields) <> 'array' then
    raise exception 'fields must be an array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_fields) < 1 or jsonb_array_length(p_fields) > 12 then
    raise exception 'A habit needs between 1 and 12 fields' using errcode = '22023';
  end if;

  for f in select value from jsonb_array_elements(p_fields) loop
    v_key := f ->> 'field_key';
    if v_key is null or v_key !~ '^[a-z][a-z0-9_]{0,39}$' then
      raise exception 'Invalid field key %', coalesce(v_key, '(missing)') using errcode = '22023';
    end if;
    if v_key = any (v_keys) then
      raise exception 'Duplicate field key %', v_key using errcode = '22023';
    end if;
    v_keys := v_keys || v_key;

    v_type := (f ->> 'field_type')::public.field_type;
    v_options := coalesce(
      (select array_agg(btrim(o)) from jsonb_array_elements_text(coalesce(f -> 'options', '[]'::jsonb)) o
        where btrim(o) <> ''),
      '{}');
    if v_type in ('radio', 'dropdown') and
       (select count(distinct o) from unnest(v_options) o) <> cardinality(v_options) then
      raise exception 'Options for "%" must be unique', f ->> 'label' using errcode = '22023';
    end if;
    if v_type in ('number', 'text') then
      v_options := '{}';
    end if;

    v_validation := coalesce(f -> 'validation', '{}'::jsonb);
    if jsonb_typeof(v_validation) <> 'object' then
      raise exception 'validation must be an object' using errcode = '22023';
    end if;
    -- Keep only the keys we understand, with the right JSON types.
    v_validation := jsonb_strip_nulls(jsonb_build_object(
      'min',       case when jsonb_typeof(v_validation -> 'min') = 'number' then v_validation -> 'min' end,
      'max',       case when jsonb_typeof(v_validation -> 'max') = 'number' then v_validation -> 'max' end,
      'integer',   case when jsonb_typeof(v_validation -> 'integer') = 'boolean' then v_validation -> 'integer' end,
      'maxLength', case when jsonb_typeof(v_validation -> 'maxLength') = 'number' then v_validation -> 'maxLength' end
    ));
    if (v_validation ? 'min') and (v_validation ? 'max')
       and (v_validation ->> 'min')::numeric > (v_validation ->> 'max')::numeric then
      raise exception 'Minimum cannot be greater than maximum for "%"', f ->> 'label' using errcode = '22023';
    end if;

    insert into public.habit_field_definitions
      (habit_id, version, field_key, label, field_type, unit, options, required, validation, sort_order)
    values (
      p_habit_id, p_version, v_key, btrim(f ->> 'label'), v_type,
      case when v_type = 'number' then nullif(btrim(coalesce(f ->> 'unit', '')), '') end,
      v_options,
      coalesce((f ->> 'required')::boolean, false),
      v_validation,
      i
    );
    i := i + 1;
  end loop;
end;
$$;

-- ===========================================================================
-- Internal: create the five default habits for a new user.
-- ===========================================================================
create or replace function public._create_habit_internal(
  p_owner uuid, p_name text, p_icon text, p_color text, p_template text, p_notes boolean,
  p_sort integer, p_fields jsonb, p_goal_key text, p_goal_op public.goal_operator, p_goal_value jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  insert into public.habits (owner_id, name, icon, color, template_key, notes_enabled, sort_order)
  values (p_owner, p_name, p_icon, p_color, p_template, p_notes, p_sort)
  returning id into v_id;
  perform public._write_field_version(v_id, 1, p_fields);
  if p_goal_key is not null then
    update public.habits
       set goal_field_key = p_goal_key, goal_operator = p_goal_op, goal_value = p_goal_value
     where id = v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public._create_default_habits(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._create_habit_internal(p_user, 'Sleep', 'moon', 'lavender', 'sleep', false, 0,
    '[{"field_key":"hours","label":"Hours slept","field_type":"number","unit":"h","required":true,
       "validation":{"min":0,"max":24}}]'::jsonb,
    'hours', 'gte', '7'::jsonb);
  perform public._create_habit_internal(p_user, 'Exercise', 'dumbbell', 'peach', 'exercise', false, 1,
    '[{"field_key":"hours","label":"Exercise time","field_type":"number","unit":"h","required":true,
       "validation":{"min":0,"max":24}}]'::jsonb,
    'hours', 'gte', '0.5'::jsonb);
  perform public._create_habit_internal(p_user, 'Walking', 'footprints', 'mint', 'walking', false, 2,
    '[{"field_key":"steps","label":"Steps","field_type":"number","unit":"steps","required":true,
       "validation":{"min":0,"max":200000,"integer":true}}]'::jsonb,
    'steps', 'gte', '6000'::jsonb);
  perform public._create_habit_internal(p_user, 'Junk Food', 'cookie', 'rose', 'junk_food', true, 3,
    '[{"field_key":"had_junk_food","label":"Did you eat junk food?","field_type":"radio",
       "options":["No","Yes"],"required":true}]'::jsonb,
    'had_junk_food', 'eq', '"No"'::jsonb);
  perform public._create_habit_internal(p_user, 'Water', 'glass-water', 'sky', 'water', false, 4,
    '[{"field_key":"litres","label":"Water","field_type":"number","unit":"L","required":true,
       "validation":{"min":0,"max":20}}]'::jsonb,
    'litres', 'gte', '2'::jsonb);
end;
$$;

-- ===========================================================================
-- New auth user -> profile, settings, default habits.
-- Username comes from sign-up metadata; sign-up uses an internal, non-deliverable address.
-- ===========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  v_display  text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  v_tz       text := coalesce(new.raw_user_meta_data ->> 'timezone', 'UTC');
begin
  if v_username !~ '^[a-z0-9_]{3,20}$' then
    -- Fallback for users created outside the app (e.g. dashboard): derive from email.
    v_username := left(regexp_replace(lower(split_part(coalesce(new.email, 'user'), '@', 1)),
                                      '[^a-z0-9_]', '', 'g'), 12);
    if char_length(v_username) < 3 then v_username := 'user'; end if;
    v_username := v_username || '_' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  if v_display = '' or char_length(v_display) > 40 then
    v_display := v_username;
  end if;
  if not public.is_valid_timezone(v_tz) then
    v_tz := 'UTC';
  end if;

  insert into public.profiles (id, username, display_name, timezone)
  values (new.id, v_username, v_display, v_tz);
  insert into public.user_settings (user_id) values (new.id);
  perform public._create_default_habits(new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===========================================================================
-- profiles: validate time zone; username is immutable.
-- ===========================================================================
create or replace function public.profiles_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_valid_timezone(new.timezone) then
    raise exception 'Unknown time zone %', new.timezone using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' and new.username <> old.username then
    raise exception 'Username cannot be changed' using errcode = '42501';
  end if;
  new.display_name := btrim(new.display_name);
  return new;
end;
$$;

create trigger profiles_before_write
  before insert or update on public.profiles
  for each row execute function public.profiles_before_write();

-- ===========================================================================
-- habits: goal must reference a field of the current version; going private
-- removes the habit from any challenge so it can never leak through progress.
-- ===========================================================================
create or replace function public.habits_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_type public.field_type;
begin
  new.name := btrim(new.name);
  if new.goal_field_key is not null then
    select d.field_type into v_type
      from public.habit_field_definitions d
     where d.habit_id = new.id and d.version = new.current_version and d.field_key = new.goal_field_key;
    if v_type is null then
      raise exception 'Goal field % is not part of this habit', new.goal_field_key using errcode = '22023';
    end if;
    if v_type <> 'number' and new.goal_operator <> 'eq' then
      raise exception 'Only number fields support at-least / at-most goals' using errcode = '22023';
    end if;
    if v_type = 'number' and jsonb_typeof(new.goal_value) <> 'number' then
      raise exception 'Goal value must be a number' using errcode = '22023';
    end if;
    if v_type <> 'number' and jsonb_typeof(new.goal_value) <> 'string' then
      raise exception 'Goal value must be text' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

create trigger habits_before_update
  before update on public.habits
  for each row execute function public.habits_before_update();

create or replace function public.habits_after_visibility_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare r record;
begin
  if new.visibility = 'private' and old.visibility = 'family' then
    for r in
      delete from public.challenge_participants cp
       where cp.habit_id = new.id
      returning cp.challenge_id
    loop
      insert into public.notifications (user_id, kind, title, body, data)
      select new.owner_id, 'challenge_left',
             'You left a challenge',
             format('"%s" is now private, so it was removed from the challenge "%s".', new.name, c.title),
             jsonb_build_object('challenge_id', c.id)
        from public.family_challenges c where c.id = r.challenge_id;
    end loop;
  end if;
  return new;
end;
$$;

create trigger habits_after_visibility_change
  after update of visibility on public.habits
  for each row execute function public.habits_after_visibility_change();

-- ===========================================================================
-- habit_entries: validate values against the versioned field definitions and
-- compute is_complete. SECURITY DEFINER only to read definitions/profile reliably;
-- ownership is still enforced by RLS policies on the table.
-- ===========================================================================
create or replace function public.habit_entries_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  h public.habits%rowtype;
  d record;
  v jsonb;
  v_num numeric;
  v_complete boolean;
  v_any boolean := false;
  v_today date;
  v_goal_val jsonb;
  v_goal_type public.field_type;
begin
  select * into h from public.habits where id = new.habit_id;
  if not found then
    raise exception 'Habit not found' using errcode = '23503';
  end if;

  -- Entries always belong to the habit owner.
  if new.user_id is distinct from h.owner_id then
    raise exception 'Entries can only be recorded by the habit owner' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and (new.habit_id <> old.habit_id or new.entry_date <> old.entry_date
                           or new.user_id <> old.user_id) then
    raise exception 'Habit, date and owner of an entry cannot change' using errcode = '42501';
  end if;

  -- No future dates (relative to the owner's local day).
  v_today := public.user_local_date(h.owner_id);
  if new.entry_date > v_today then
    raise exception 'Entries cannot be recorded for future dates' using errcode = '22023';
  end if;

  -- New entries use the current version; edits may keep their original version.
  if tg_op = 'INSERT' and new.habit_version <> h.current_version then
    raise exception 'Habit has changed, please reload' using errcode = '40001';
  end if;
  if tg_op = 'UPDATE' and new.habit_version not in (old.habit_version, h.current_version) then
    raise exception 'Invalid habit version' using errcode = '22023';
  end if;

  -- Reject unknown keys.
  if exists (
    select 1 from jsonb_object_keys(new.field_values) k
     where not exists (select 1 from public.habit_field_definitions fd
                        where fd.habit_id = h.id and fd.version = new.habit_version and fd.field_key = k)
  ) then
    raise exception 'Unknown field in entry' using errcode = '22023';
  end if;

  for d in
    select * from public.habit_field_definitions
     where habit_id = h.id and version = new.habit_version
     order by sort_order
  loop
    v := new.field_values -> d.field_key;
    if v is null or v = 'null'::jsonb or (jsonb_typeof(v) = 'string' and btrim(v #>> '{}') = '') then
      if d.required then
        raise exception '"%" is required', d.label using errcode = '22023';
      end if;
      new.field_values := new.field_values - d.field_key;
      continue;
    end if;
    v_any := true;

    case d.field_type
      when 'number' then
        if jsonb_typeof(v) <> 'number' then
          raise exception '"%" must be a number', d.label using errcode = '22023';
        end if;
        v_num := (v #>> '{}')::numeric;
        if v_num < 0 and not (d.validation ? 'min') then
          raise exception '"%" cannot be negative', d.label using errcode = '22023';
        end if;
        if (d.validation ? 'min') and v_num < (d.validation ->> 'min')::numeric then
          raise exception '"%" must be at least %', d.label, d.validation ->> 'min' using errcode = '22023';
        end if;
        if (d.validation ? 'max') and v_num > (d.validation ->> 'max')::numeric then
          raise exception '"%" must be at most %', d.label, d.validation ->> 'max' using errcode = '22023';
        end if;
        if coalesce((d.validation ->> 'integer')::boolean, false) and v_num <> trunc(v_num) then
          raise exception '"%" must be a whole number', d.label using errcode = '22023';
        end if;
        if abs(v_num) >= 1e9 then
          raise exception '"%" is too large', d.label using errcode = '22023';
        end if;
      when 'text' then
        if jsonb_typeof(v) <> 'string' then
          raise exception '"%" must be text', d.label using errcode = '22023';
        end if;
        if char_length(v #>> '{}') > least(coalesce((d.validation ->> 'maxLength')::int, 500), 2000) then
          raise exception '"%" is too long', d.label using errcode = '22023';
        end if;
      else -- radio / dropdown
        if jsonb_typeof(v) <> 'string' or not ((v #>> '{}') = any (d.options)) then
          raise exception 'Choose a valid option for "%"', d.label using errcode = '22023';
        end if;
    end case;
  end loop;

  if not v_any then
    raise exception 'Enter at least one value' using errcode = '22023';
  end if;

  -- Notes are only kept when the habit has notes enabled (existing notes are preserved).
  if not h.notes_enabled then
    new.notes := case when tg_op = 'UPDATE' then old.notes else null end;
  else
    new.notes := nullif(btrim(coalesce(new.notes, '')), '');
  end if;

  -- Completion: goal if configured (and applicable to this version), otherwise
  -- "all required fields filled" (already guaranteed above).
  v_complete := true;
  if h.goal_field_key is not null then
    select fd.field_type into v_goal_type
      from public.habit_field_definitions fd
     where fd.habit_id = h.id and fd.version = new.habit_version and fd.field_key = h.goal_field_key;
    if v_goal_type is not null then
      v_goal_val := new.field_values -> h.goal_field_key;
      if v_goal_val is null then
        v_complete := false;
      elsif v_goal_type = 'number' then
        v_complete := case h.goal_operator
          when 'gte' then (v_goal_val #>> '{}')::numeric >= (h.goal_value #>> '{}')::numeric
          when 'lte' then (v_goal_val #>> '{}')::numeric <= (h.goal_value #>> '{}')::numeric
          else (v_goal_val #>> '{}')::numeric = (h.goal_value #>> '{}')::numeric
        end;
      else
        v_complete := (v_goal_val #>> '{}') = (h.goal_value #>> '{}');
      end if;
    end if;
  end if;
  new.is_complete := v_complete;
  return new;
end;
$$;

create trigger habit_entries_before_write
  before insert or update on public.habit_entries
  for each row execute function public.habit_entries_before_write();

-- ===========================================================================
-- Streaks: consecutive *scheduled* days with a completed entry.
-- Current streak ends today or yesterday's scheduled day (today pending never breaks it).
-- SECURITY INVOKER: callers only see entries RLS lets them see.
-- ===========================================================================
create or replace function public.habit_streak(p_habit_id uuid)
returns table (current_streak integer, best_streak integer)
language sql
stable
set search_path = ''
as $$
  with h as (
    select hb.id, hb.frequency_days, hb.owner_id,
           (now() at time zone coalesce(p.timezone, 'UTC'))::date as today
      from public.habits hb
      left join public.profiles p on p.id = hb.owner_id
     where hb.id = p_habit_id
  ),
  done as (
    select e.entry_date from public.habit_entries e
     where e.habit_id = p_habit_id and e.is_complete
  ),
  days as (
    select g::date as d, (g::date in (select entry_date from done)) as ok
      from h,
           generate_series(
             coalesce((select min(entry_date) from done), (select today from h)),
             (select today from h), interval '1 day') g
     where extract(dow from g)::smallint = any (h.frequency_days)
  ),
  trimmed as (  -- drop today if it is not done yet
    select d, ok from days
     where not (d = (select today from h) and not ok)
  ),
  cur as (
    select count(*)::int as n from (
      select ok, sum(case when ok then 0 else 1 end) over (order by d desc) as breaks
        from trimmed
    ) t where breaks = 0
  ),
  islands as (
    select count(*)::int as len from (
      select d, ok,
             row_number() over (order by d) - row_number() over (partition by ok order by d) as grp
        from days
    ) t where ok group by grp
  )
  select coalesce((select n from cur), 0),
         coalesce((select max(len) from islands), 0)
  where exists (select 1 from h);
$$;

-- ===========================================================================
-- Achievements: awarded by the server only, never revoked.
-- ===========================================================================
create or replace function public._award(p_user uuid, p_code text, p_habit uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_ach public.achievements%rowtype;
begin
  select * into v_ach from public.achievements where code = p_code;
  if not found then return; end if;
  insert into public.user_achievements (user_id, achievement_id, habit_id)
  values (p_user, v_ach.id, p_habit)
  on conflict (user_id, achievement_id) do nothing;
  if found then
    insert into public.notifications (user_id, kind, title, body, data)
    values (p_user, 'badge_earned', 'New badge: ' || v_ach.name, v_ach.description,
            jsonb_build_object('achievement_code', p_code));
  end if;
end;
$$;

-- Streak computation for a specific owner, independent of the caller's RLS view.
create or replace function public._owner_streak(p_habit_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  h record;
  v_day date;
  v_n integer := 0;
  v_guard integer := 0;
begin
  select hb.frequency_days, public.user_local_date(hb.owner_id) as today
    into h from public.habits hb where hb.id = p_habit_id;
  if not found then return 0; end if;
  v_day := h.today;
  -- today counts only if already complete
  if extract(dow from v_day)::smallint = any (h.frequency_days)
     and not exists (select 1 from public.habit_entries e
                      where e.habit_id = p_habit_id and e.entry_date = v_day and e.is_complete) then
    v_day := v_day - 1;
  end if;
  loop
    v_guard := v_guard + 1;
    exit when v_guard > 4000;
    if extract(dow from v_day)::smallint = any (h.frequency_days) then
      exit when not exists (select 1 from public.habit_entries e
                             where e.habit_id = p_habit_id and e.entry_date = v_day and e.is_complete);
      v_n := v_n + 1;
    end if;
    v_day := v_day - 1;
  end loop;
  return v_n;
end;
$$;

create or replace function public.evaluate_achievements(p_user uuid, p_habit uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
  v_complete integer;
  v_days integer;
  v_streak integer;
  v_today date := public.user_local_date(p_user);
begin
  select count(*), count(*) filter (where is_complete), count(distinct entry_date)
    into v_total, v_complete, v_days
    from public.habit_entries where user_id = p_user;

  if v_total >= 1 then perform public._award(p_user, 'first_entry'); end if;
  if v_complete >= 10 then perform public._award(p_user, 'complete_10'); end if;
  if v_complete >= 50 then perform public._award(p_user, 'complete_50'); end if;
  if v_complete >= 100 then perform public._award(p_user, 'complete_100'); end if;
  if v_days >= 30 then perform public._award(p_user, 'active_30_days'); end if;

  if p_habit is not null then
    v_streak := public._owner_streak(p_habit);
    if v_streak >= 3 then perform public._award(p_user, 'streak_3', p_habit); end if;
    if v_streak >= 7 then perform public._award(p_user, 'streak_7', p_habit); end if;
    if v_streak >= 30 then perform public._award(p_user, 'streak_30', p_habit); end if;
  end if;

  -- Perfect day: every active habit scheduled today is complete.
  if exists (
       select 1 from public.habits h
        where h.owner_id = p_user and h.archived_at is null
          and extract(dow from v_today)::smallint = any (h.frequency_days))
     and not exists (
       select 1 from public.habits h
        where h.owner_id = p_user and h.archived_at is null
          and extract(dow from v_today)::smallint = any (h.frequency_days)
          and not exists (select 1 from public.habit_entries e
                           where e.habit_id = h.id and e.entry_date = v_today and e.is_complete))
  then
    perform public._award(p_user, 'perfect_day');
  end if;
end;
$$;

create or replace function public.habit_entries_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.evaluate_achievements(new.user_id, new.habit_id);
  return null;
end;
$$;

create trigger habit_entries_after_write
  after insert or update on public.habit_entries
  for each row execute function public.habit_entries_after_write();

-- ===========================================================================
-- Family membership events.
-- ===========================================================================
create or replace function public.family_members_before_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_other_admins integer; v_others integer;
begin
  if tg_op = 'UPDATE' and new.family_id <> old.family_id then
    raise exception 'Cannot move members between families' using errcode = '42501';
  end if;
  -- Cascades (whole family deleted, or the user's account deleted) are always allowed.
  if tg_op = 'DELETE' and (
       not exists (select 1 from public.families f where f.id = old.family_id)
       or not exists (select 1 from auth.users u where u.id = old.user_id)) then
    return old;
  end if;
  -- Removing or demoting the last admin is only allowed when nobody else remains.
  if old.role = 'admin' and (tg_op = 'DELETE' or new.role <> 'admin') then
    select count(*) filter (where role = 'admin' and user_id <> old.user_id),
           count(*) filter (where user_id <> old.user_id)
      into v_other_admins, v_others
      from public.family_members where family_id = old.family_id;
    if v_other_admins = 0 and v_others > 0 then
      raise exception 'Make another member an admin first' using errcode = 'P0001';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger family_members_before_change
  before update or delete on public.family_members
  for each row execute function public.family_members_before_change();

create or replace function public.family_members_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_name text;
begin
  select display_name into v_name from public.profiles where id = new.user_id;
  insert into public.notifications (user_id, kind, title, body, data)
  select fm.user_id, 'member_joined', coalesce(v_name, 'Someone') || ' joined your family',
         'Say hello and share a habit together.', jsonb_build_object('user_id', new.user_id)
    from public.family_members fm
   where fm.family_id = new.family_id and fm.user_id <> new.user_id;
  perform public._award(new.user_id, 'joined_family');
  return null;
end;
$$;

create trigger family_members_after_insert
  after insert on public.family_members
  for each row execute function public.family_members_after_insert();

create or replace function public.family_members_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Leaving a family removes you from its challenges.
  delete from public.challenge_participants cp
   using public.family_challenges c
   where cp.challenge_id = c.id and c.family_id = old.family_id and cp.user_id = old.user_id;
  -- An empty family is deleted; a family left without an admin promotes its longest member.
  if not exists (select 1 from public.family_members where family_id = old.family_id) then
    delete from public.families where id = old.family_id;
  elsif not exists (select 1 from public.family_members
                     where family_id = old.family_id and role = 'admin') then
    update public.family_members set role = 'admin'
     where id = (select id from public.family_members where family_id = old.family_id
                  order by joined_at, id limit 1);
  end if;
  return null;
end;
$$;

create trigger family_members_after_delete
  after delete on public.family_members
  for each row execute function public.family_members_after_delete();

-- ===========================================================================
-- Challenges.
-- ===========================================================================
create or replace function public.challenge_participants_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.family_challenges%rowtype;
  h public.habits%rowtype;
  d public.habit_field_definitions%rowtype;
begin
  select * into c from public.family_challenges where id = new.challenge_id;
  select * into h from public.habits where id = new.habit_id;
  if h.id is null or h.owner_id <> new.user_id then
    raise exception 'You can only join with your own habit' using errcode = '42501';
  end if;
  if h.visibility <> 'family' then
    raise exception 'Share this habit with your family before using it in a challenge' using errcode = '42501';
  end if;
  if not exists (select 1 from public.family_members fm
                  where fm.user_id = new.user_id and fm.family_id = c.family_id) then
    raise exception 'Not a member of this family' using errcode = '42501';
  end if;
  if c.aggregation = 'sum' then
    select * into d from public.habit_field_definitions
     where habit_id = h.id and version = h.current_version and field_key = new.field_key;
    if d.id is null or d.field_type <> 'number' then
      raise exception 'Choose a number field for this challenge' using errcode = '22023';
    end if;
    if lower(coalesce(d.unit, '')) <> lower(coalesce(c.unit, '')) then
      raise exception 'This field uses "%" but the challenge uses "%"', coalesce(d.unit, 'no unit'), c.unit
        using errcode = '22023';
    end if;
  else
    new.field_key := null;
  end if;
  return new;
end;
$$;

create trigger challenge_participants_before_write
  before insert or update on public.challenge_participants
  for each row execute function public.challenge_participants_before_write();

create or replace function public.family_challenges_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, kind, title, body, data)
  select fm.user_id, 'challenge_created', 'New family challenge: ' || new.title,
         'Join in with one of your shared habits if you like.',
         jsonb_build_object('challenge_id', new.id)
    from public.family_members fm
   where fm.family_id = new.family_id and fm.user_id <> coalesce(new.created_by, '00000000-0000-0000-0000-000000000000');
  return null;
end;
$$;

create trigger family_challenges_after_insert
  after insert on public.family_challenges
  for each row execute function public.family_challenges_after_insert();
