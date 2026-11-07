-- HabitNest: Web Push reminders.
-- A pg_cron job calls the `send-reminders` Edge Function every 15 minutes. The function calls
-- claim_due_reminders(), which atomically records each (user, kind, local day) in
-- reminder_deliveries, so a reminder can never be sent twice even if runs overlap.
-- Secrets (project URL, cron secret, VAPID keys) live in Supabase Vault, never in git.

-- Number of a user's active habits scheduled on their local day that are not complete.
create or replace function public._pending_habits_today(p_user uuid, p_local_date date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
    from public.habits h
   where h.owner_id = p_user and h.archived_at is null
     and extract(dow from p_local_date)::smallint = any (h.frequency_days)
     and not exists (select 1 from public.habit_entries e
                      where e.habit_id = h.id and e.entry_date = p_local_date and e.is_complete);
$$;

create or replace function public.claim_due_reminders(
  p_now timestamptz default now(), p_window interval default interval '60 minutes')
returns table (user_id uuid, kind public.reminder_kind, local_date date, pending integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  return query
  with candidates as (
    select s.user_id, s.daily_reminder_enabled, s.daily_reminder_time,
           s.incomplete_reminder_enabled, s.incomplete_reminder_time,
           (p_now at time zone p.timezone) as local_now
      from public.user_settings s
      join public.profiles p on p.id = s.user_id
     where (s.daily_reminder_enabled or s.incomplete_reminder_enabled)
       and exists (select 1 from public.push_subscriptions ps where ps.user_id = s.user_id)
  ),
  due as (
    select c.user_id, 'daily_reminder'::public.reminder_kind as kind, c.local_now::date as local_date
      from candidates c
     where c.daily_reminder_enabled
       and c.local_now::date + c.daily_reminder_time <= c.local_now
       and c.local_now::date + c.daily_reminder_time > c.local_now - p_window
    union all
    select c.user_id, 'incomplete_reminder'::public.reminder_kind, c.local_now::date
      from candidates c
     where c.incomplete_reminder_enabled
       and c.local_now::date + c.incomplete_reminder_time <= c.local_now
       and c.local_now::date + c.incomplete_reminder_time > c.local_now - p_window
       and public._pending_habits_today(c.user_id, c.local_now::date) > 0
  ),
  claimed as (
    insert into public.reminder_deliveries as rd (user_id, kind, local_date)
    select d.user_id, d.kind, d.local_date from due d
    on conflict (user_id, kind, local_date) do nothing
    returning rd.user_id, rd.kind, rd.local_date
  )
  select cl.user_id, cl.kind, cl.local_date, public._pending_habits_today(cl.user_id, cl.local_date)
    from claimed cl;
end;
$$;

-- Returns reminder secrets from Vault. Executable by service_role only (see grants migration).
create or replace function public.get_reminder_secrets()
returns table (cron_secret text, vapid_public_key text, vapid_private_key text, vapid_subject text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query execute $q$
    select
      (select decrypted_secret from vault.decrypted_secrets where name = 'habitnest_cron_secret'),
      (select decrypted_secret from vault.decrypted_secrets where name = 'habitnest_vapid_public_key'),
      (select decrypted_secret from vault.decrypted_secrets where name = 'habitnest_vapid_private_key'),
      (select decrypted_secret from vault.decrypted_secrets where name = 'habitnest_vapid_subject')
  $q$;
end;
$$;

-- Schedule the job when pg_cron / pg_net are available (they are on Supabase; skipped in
-- local test databases). cron.schedule with an existing job name updates it (idempotent).
do $outer$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    execute 'create extension if not exists pg_cron';
    execute 'create extension if not exists pg_net with schema extensions';
    execute $sql$
      select cron.schedule(
        'habitnest-send-reminders',
        '*/15 * * * *',
        $cmd$
          select net.http_post(
            url := (select decrypted_secret from vault.decrypted_secrets where name = 'habitnest_project_url')
                   || '/functions/v1/send-reminders',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'x-cron-secret',
              (select decrypted_secret from vault.decrypted_secrets where name = 'habitnest_cron_secret')),
            body := '{}'::jsonb,
            timeout_milliseconds := 30000
          )
          where exists (select 1 from vault.decrypted_secrets where name = 'habitnest_project_url');
        $cmd$
      )
    $sql$;
  end if;
end
$outer$;
