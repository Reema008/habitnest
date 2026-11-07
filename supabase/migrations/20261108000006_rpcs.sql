-- HabitNest: RPCs (called via supabase.rpc). SECURITY DEFINER functions always derive
-- the acting user from auth.uid() and validate permissions explicitly.

-- ---------------------------------------------------------------------------
-- Usernames
-- ---------------------------------------------------------------------------
create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select lower(btrim(p_username)) ~ '^[a-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles where username = lower(btrim(p_username)));
$$;

-- Clears the forced-password-change flag after the client changed its password.
create or replace function public.ack_password_changed()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set must_change_password = false where id = (select auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Families
-- ---------------------------------------------------------------------------
create or replace function public._require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare v uuid := auth.uid();
begin
  if v is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  return v;
end;
$$;

create or replace function public.create_family(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public._require_user();
  v_family uuid;
begin
  if exists (select 1 from public.family_members where user_id = v_user) then
    raise exception 'You are already in a family. Leave it first to create a new one.' using errcode = 'P0001';
  end if;
  insert into public.families (name, created_by) values (btrim(p_name), v_user) returning id into v_family;
  insert into public.family_members (family_id, user_id, role) values (v_family, v_user, 'admin');
  return v_family;
end;
$$;

-- 10 characters from an unambiguous 32-symbol alphabet using strong randomness (50 bits).
create or replace function public._new_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex')
          || decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  code text := '';
  i integer;
begin
  -- skip the UUID version/variant bytes (6 and 8 of each UUID)
  foreach i in array array[0,1,2,3,4,5,7,9,10,11] loop
    code := code || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  return code;
end;
$$;

create or replace function public.create_invitation(p_max_uses integer default 10, p_valid_days integer default 7)
returns table (id uuid, code text, expires_at timestamptz, max_uses integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := public._require_user();
  v_family uuid := public.my_family_id();
begin
  if v_family is null or not public.is_family_admin(v_family) then
    raise exception 'Only family admins can invite members' using errcode = '42501';
  end if;
  if p_max_uses not between 1 and 50 or p_valid_days not between 1 and 30 then
    raise exception 'Invalid invitation settings' using errcode = '22023';
  end if;
  return query
    insert into public.family_invitations as fi (family_id, code, created_by, expires_at, max_uses)
    values (v_family, public._new_invite_code(), v_user, now() + make_interval(days => p_valid_days), p_max_uses)
    returning fi.id, fi.code, fi.expires_at, fi.max_uses;
end;
$$;

-- Public preview so a person opening an invite link sees which family it is for.
-- Only reveals the family name and member count for a valid, unexpired code.
create or replace function public.preview_invitation(p_code text)
returns table (family_name text, member_count integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public._require_user();
  return query
    select f.name, (select count(*)::int from public.family_members m where m.family_id = f.id)
      from public.family_invitations i
      join public.families f on f.id = i.family_id
     where i.code = upper(btrim(p_code))
       and i.revoked_at is null and i.expires_at > now() and i.use_count < i.max_uses;
end;
$$;

create or replace function public.join_family(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public._require_user();
  v_inv public.family_invitations%rowtype;
  v_failures integer;
begin
  if exists (select 1 from public.family_members where user_id = v_user) then
    raise exception 'You are already in a family. Leave it first to join another.' using errcode = 'P0001';
  end if;

  select count(*) into v_failures
    from public.family_join_attempts
   where user_id = v_user and not succeeded and attempted_at > now() - interval '1 hour';
  if v_failures >= 10 then
    raise exception 'Too many attempts. Please try again later.' using errcode = 'P0001';
  end if;

  select * into v_inv
    from public.family_invitations
   where code = upper(btrim(coalesce(p_code, '')))
   for update;

  if not found or v_inv.revoked_at is not null or v_inv.expires_at <= now()
     or v_inv.use_count >= v_inv.max_uses then
    insert into public.family_join_attempts (user_id, succeeded) values (v_user, false);
    -- Same message for every failure so codes cannot be probed.
    return null;
  end if;

  insert into public.family_members (family_id, user_id, role) values (v_inv.family_id, v_user, 'member');
  update public.family_invitations set use_count = use_count + 1 where id = v_inv.id;
  insert into public.family_join_attempts (user_id, succeeded) values (v_user, true);
  return v_inv.family_id;
end;
$$;

create or replace function public.leave_family()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid := public._require_user();
begin
  delete from public.family_members where user_id = v_user;
end;
$$;

create or replace function public.remove_family_member(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public._require_user();
  v_family uuid := public.my_family_id();
begin
  if v_family is null or not public.is_family_admin(v_family) then
    raise exception 'Only family admins can remove members' using errcode = '42501';
  end if;
  if p_user = v_user then
    raise exception 'Use "Leave family" to remove yourself' using errcode = 'P0001';
  end if;
  delete from public.family_members where family_id = v_family and user_id = p_user;
  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.set_family_member_role(p_user uuid, p_role public.family_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_family uuid := public.my_family_id();
begin
  perform public._require_user();
  if v_family is null or not public.is_family_admin(v_family) then
    raise exception 'Only family admins can change roles' using errcode = '42501';
  end if;
  update public.family_members set role = p_role where family_id = v_family and user_id = p_user;
  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Habits
-- p_habit:  {name, description, icon, color, visibility, notes_enabled, frequency_days[], sort_order}
-- p_fields: see _write_field_version
-- p_goal:   null or {field_key, operator: gte|lte|eq, value}
-- ---------------------------------------------------------------------------
create or replace function public._apply_goal(p_habit_id uuid, p_goal jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_goal is null or jsonb_typeof(p_goal) = 'null' then
    update public.habits set goal_field_key = null, goal_operator = null, goal_value = null where id = p_habit_id;
  else
    update public.habits
       set goal_field_key = p_goal ->> 'field_key',
           goal_operator  = (p_goal ->> 'operator')::public.goal_operator,
           goal_value     = p_goal -> 'value'
     where id = p_habit_id;
  end if;
end;
$$;

create or replace function public.create_habit(p_habit jsonb, p_fields jsonb, p_goal jsonb default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public._require_user();
  v_id uuid;
  v_count integer;
begin
  select count(*) into v_count from public.habits where owner_id = v_user;
  if v_count >= 100 then
    raise exception 'You have reached the maximum number of habits' using errcode = 'P0001';
  end if;

  insert into public.habits (owner_id, name, description, icon, color, visibility, notes_enabled,
                             frequency_days, sort_order)
  values (
    v_user,
    btrim(p_habit ->> 'name'),
    nullif(btrim(coalesce(p_habit ->> 'description', '')), ''),
    coalesce(p_habit ->> 'icon', 'sparkles'),
    coalesce(p_habit ->> 'color', 'lavender'),
    coalesce((p_habit ->> 'visibility')::public.habit_visibility, 'private'),
    coalesce((p_habit ->> 'notes_enabled')::boolean, false),
    coalesce((select array_agg(x::smallint order by x::smallint)
                from jsonb_array_elements_text(p_habit -> 'frequency_days') x), '{0,1,2,3,4,5,6}'),
    coalesce((p_habit ->> 'sort_order')::integer, v_count)
  )
  returning id into v_id;

  perform public._write_field_version(v_id, 1, p_fields);
  perform public._apply_goal(v_id, p_goal);
  perform public._award(v_user, 'first_custom_habit');
  return v_id;
end;
$$;

-- Saves a new field version only when the fields actually changed; old entries keep
-- pointing at the version they were recorded with, so history always stays readable.
create or replace function public.save_habit_fields(p_habit_id uuid, p_fields jsonb, p_goal jsonb default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public._require_user();
  h public.habits%rowtype;
  v_old jsonb;
  v_new jsonb;
  v_version integer;
begin
  select * into h from public.habits where id = p_habit_id for update;
  if not found or h.owner_id <> v_user then
    raise exception 'Habit not found' using errcode = 'P0002';
  end if;

  -- Clear the goal first so the goal check never sees a stale field reference.
  update public.habits set goal_field_key = null, goal_operator = null, goal_value = null where id = h.id;

  v_version := h.current_version + 1;
  perform public._write_field_version(h.id, v_version, p_fields);

  select jsonb_agg(jsonb_build_array(field_key, label, field_type, unit, options, required, validation)
                   order by sort_order)
    into v_old from public.habit_field_definitions where habit_id = h.id and version = h.current_version;
  select jsonb_agg(jsonb_build_array(field_key, label, field_type, unit, options, required, validation)
                   order by sort_order)
    into v_new from public.habit_field_definitions where habit_id = h.id and version = v_version;

  if v_old = v_new then
    delete from public.habit_field_definitions where habit_id = h.id and version = v_version;
    v_version := h.current_version;
  else
    update public.habits set current_version = v_version where id = h.id;
  end if;

  perform public._apply_goal(h.id, p_goal);
  return v_version;
end;
$$;

-- ---------------------------------------------------------------------------
-- Push subscriptions: one row per browser endpoint; re-registering moves it to the caller.
-- ---------------------------------------------------------------------------
create or replace function public.register_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid := public._require_user();
begin
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_key, user_agent)
  values (v_user, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh,
        auth_key = excluded.auth_key, user_agent = excluded.user_agent;
end;
$$;
