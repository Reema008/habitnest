-- HabitNest: core tables. RLS is enabled here and policies are added in 0004.
-- Client write access is narrowed with column-level grants at the end of this file,
-- so computed/ownership columns can only be set by triggers and SECURITY DEFINER RPCs.

-- ---------------------------------------------------------------------------
-- Profiles & settings
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  username              text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name          text not null check (char_length(btrim(display_name)) between 1 and 40),
  avatar_url            text check (avatar_url is null or char_length(avatar_url) <= 500),
  avatar_preset         text check (avatar_preset is null or avatar_preset ~ '^[a-z0-9_-]{1,30}$'),
  pet_type              public.pet_type,
  timezone              text not null default 'UTC',
  must_change_password  boolean not null default false,
  onboarded_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table public.user_settings (
  user_id                      uuid primary key references auth.users (id) on delete cascade,
  theme_mode                   public.theme_mode not null default 'system',
  daily_reminder_enabled       boolean not null default false,
  daily_reminder_time          time not null default '20:00',
  incomplete_reminder_enabled  boolean not null default false,
  incomplete_reminder_time     time not null default '21:00',
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Families
-- ---------------------------------------------------------------------------
create table public.families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 50),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.family_members (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  -- One family per user.
  user_id     uuid not null unique references auth.users (id) on delete cascade,
  role        public.family_role not null default 'member',
  joined_at   timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index family_members_family_idx on public.family_members (family_id);

create table public.family_invitations (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  code        text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{10}$'),
  created_by  uuid references auth.users (id) on delete set null,
  expires_at  timestamptz not null default (now() + interval '7 days'),
  max_uses    integer not null default 10 check (max_uses between 1 and 50),
  use_count   integer not null default 0 check (use_count >= 0),
  revoked_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index family_invitations_family_idx on public.family_invitations (family_id);

-- Server-only log used to rate-limit invitation code guessing.
create table public.family_join_attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  succeeded     boolean not null,
  attempted_at  timestamptz not null default now()
);
create index family_join_attempts_user_idx on public.family_join_attempts (user_id, attempted_at desc);

-- ---------------------------------------------------------------------------
-- Habits (versioned field definitions) and entries
-- ---------------------------------------------------------------------------
create table public.habits (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references auth.users (id) on delete cascade,
  name             text not null check (char_length(btrim(name)) between 1 and 60),
  description      text check (description is null or char_length(description) <= 300),
  icon             text not null default 'sparkles' check (icon ~ '^[a-z0-9-]{1,40}$'),
  color            text not null default 'lavender' check (color ~ '^[a-z]{3,20}$'),
  template_key     text check (template_key in ('sleep', 'exercise', 'walking', 'junk_food', 'water')),
  visibility       public.habit_visibility not null default 'private',
  notes_enabled    boolean not null default false,
  current_version  integer not null default 1 check (current_version >= 1),
  frequency_days   smallint[] not null default '{0,1,2,3,4,5,6}'
                   check (frequency_days <@ '{0,1,2,3,4,5,6}'::smallint[]
                          and cardinality(frequency_days) between 1 and 7),
  goal_field_key   text,
  goal_operator    public.goal_operator,
  goal_value       jsonb,
  sort_order       integer not null default 0,
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint habits_goal_all_or_none check (
    (goal_field_key is null and goal_operator is null and goal_value is null)
    or (goal_field_key is not null and goal_operator is not null and goal_value is not null)
  )
);
create index habits_owner_idx on public.habits (owner_id, sort_order);
create index habits_shared_idx on public.habits (owner_id) where visibility = 'family';

create table public.habit_field_definitions (
  id          uuid primary key default gen_random_uuid(),
  habit_id    uuid not null references public.habits (id) on delete cascade,
  version     integer not null check (version >= 1),
  field_key   text not null check (field_key ~ '^[a-z][a-z0-9_]{0,39}$'),
  label       text not null check (char_length(btrim(label)) between 1 and 60),
  field_type  public.field_type not null,
  unit        text check (unit is null or char_length(unit) <= 20),
  options     text[] not null default '{}',
  required    boolean not null default false,
  validation  jsonb not null default '{}'::jsonb check (jsonb_typeof(validation) = 'object'),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (habit_id, version, field_key),
  constraint field_options_valid check (
    case
      when field_type in ('radio', 'dropdown') then cardinality(options) between 2 and 20
      else cardinality(options) = 0
    end
  )
);
create index habit_field_definitions_habit_idx on public.habit_field_definitions (habit_id, version, sort_order);

create table public.habit_entries (
  id             uuid primary key default gen_random_uuid(),
  habit_id       uuid not null references public.habits (id) on delete cascade,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date     date not null check (entry_date >= date '2000-01-01'),
  habit_version  integer not null check (habit_version >= 1),
  field_values   jsonb not null default '{}'::jsonb check (jsonb_typeof(field_values) = 'object'),
  notes          text check (notes is null or char_length(notes) <= 2000),
  is_complete    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- One entry per habit per day.
  unique (habit_id, entry_date)
);
create index habit_entries_user_date_idx on public.habit_entries (user_id, entry_date);
create index habit_entries_habit_date_idx on public.habit_entries (habit_id, entry_date);

-- ---------------------------------------------------------------------------
-- Schedules
-- ---------------------------------------------------------------------------
create table public.schedules (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day_of_week  smallint not null check (day_of_week between 0 and 6),
  title        text not null check (char_length(btrim(title)) between 1 and 80),
  description  text check (description is null or char_length(description) <= 500),
  start_time   time not null,
  end_time     time not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint schedules_time_order check (end_time > start_time)
);
create index schedules_user_day_idx on public.schedules (user_id, day_of_week, start_time);

-- ---------------------------------------------------------------------------
-- Achievements
-- ---------------------------------------------------------------------------
create table public.achievements (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique check (code ~ '^[a-z0-9_]{2,40}$'),
  name         text not null,
  description  text not null,
  icon         text not null,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.user_achievements (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  achievement_id  uuid not null references public.achievements (id) on delete cascade,
  -- The habit that triggered the badge (null for account-level badges).
  habit_id        uuid references public.habits (id) on delete set null,
  earned_at       timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, achievement_id)
);
create index user_achievements_user_idx on public.user_achievements (user_id);

-- ---------------------------------------------------------------------------
-- Family challenges
-- ---------------------------------------------------------------------------
create table public.family_challenges (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families (id) on delete cascade,
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  title         text not null check (char_length(btrim(title)) between 1 and 80),
  description   text check (description is null or char_length(description) <= 300),
  metric_label  text not null check (char_length(btrim(metric_label)) between 1 and 40),
  unit          text check (unit is null or char_length(unit) <= 20),
  aggregation   public.challenge_aggregation not null,
  target        numeric not null check (target > 0 and target < 1e9),
  start_date    date not null,
  end_date      date not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint challenge_dates check (end_date >= start_date and end_date - start_date <= 366),
  constraint challenge_sum_needs_unit check (aggregation <> 'sum' or unit is not null)
);
create index family_challenges_family_idx on public.family_challenges (family_id, end_date desc);

create table public.challenge_participants (
  id            uuid primary key default gen_random_uuid(),
  challenge_id  uuid not null references public.family_challenges (id) on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id      uuid not null references public.habits (id) on delete cascade,
  field_key     text,
  joined_at     timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (challenge_id, user_id)
);
create index challenge_participants_habit_idx on public.challenge_participants (habit_id);
create index challenge_participants_user_idx on public.challenge_participants (user_id);

-- ---------------------------------------------------------------------------
-- In-app notifications, push subscriptions, reminder delivery log
-- ---------------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind ~ '^[a-z_]{2,40}$'),
  title       text not null,
  body        text,
  data        jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.push_subscriptions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  endpoint         text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh           text not null check (char_length(p256dh) <= 200),
  auth_key         text not null check (char_length(auth_key) <= 100),
  user_agent       text check (user_agent is null or char_length(user_agent) <= 300),
  last_success_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- Server-only: one row per (user, reminder kind, local day) guarantees no duplicate reminders.
create table public.reminder_deliveries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        public.reminder_kind not null,
  local_date  date not null,
  sent_at     timestamptz not null default now(),
  unique (user_id, kind, local_date)
);

-- Server-only: admin password reset audit log (also used for rate limiting).
create table public.admin_password_resets (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references auth.users (id) on delete set null,
  target_id   uuid references auth.users (id) on delete set null,
  family_id   uuid references public.families (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index admin_password_resets_admin_idx on public.admin_password_resets (admin_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'user_settings', 'families', 'family_members', 'family_invitations',
    'habits', 'habit_field_definitions', 'habit_entries', 'schedules', 'achievements',
    'user_achievements', 'family_challenges', 'challenge_participants', 'notifications',
    'push_subscriptions'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Enable RLS on every table (policies in 0004). Tables without policies are server-only.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    -- Not FORCE: SECURITY DEFINER helpers (owned by the migration role) must bypass RLS
    -- to evaluate family membership without recursive policy checks.
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Privileges: anon gets nothing; authenticated gets only what the app needs.
-- RLS still applies on top of these grants.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;

grant select on all tables in schema public to authenticated;
revoke select on public.family_join_attempts, public.reminder_deliveries,
                 public.admin_password_resets from authenticated;

-- profiles: inserted by trigger only; users may edit presentation fields.
grant update (display_name, avatar_url, avatar_preset, pet_type, timezone, onboarded_at)
  on public.profiles to authenticated;

grant update (theme_mode, daily_reminder_enabled, daily_reminder_time,
              incomplete_reminder_enabled, incomplete_reminder_time)
  on public.user_settings to authenticated;

-- families / members / invitations: created through RPCs.
grant update (name) on public.families to authenticated;
grant delete on public.families to authenticated;
grant update (role) on public.family_members to authenticated;
grant delete on public.family_members to authenticated;
grant update (revoked_at) on public.family_invitations to authenticated;

-- habits: created and re-versioned through RPCs; metadata editable directly.
grant update (name, description, icon, color, visibility, notes_enabled, frequency_days,
              sort_order, archived_at)
  on public.habits to authenticated;
grant delete on public.habits to authenticated;

-- habit entries: values validated and is_complete computed by trigger.
grant insert (habit_id, entry_date, habit_version, field_values, notes)
  on public.habit_entries to authenticated;
grant update (habit_version, field_values, notes) on public.habit_entries to authenticated;
grant delete on public.habit_entries to authenticated;

grant insert (day_of_week, title, description, start_time, end_time) on public.schedules to authenticated;
grant update (day_of_week, title, description, start_time, end_time) on public.schedules to authenticated;
grant delete on public.schedules to authenticated;

grant insert (family_id, title, description, metric_label, unit, aggregation, target, start_date, end_date)
  on public.family_challenges to authenticated;
grant update (title, description, target, start_date, end_date) on public.family_challenges to authenticated;
grant delete on public.family_challenges to authenticated;

grant insert (challenge_id, habit_id, field_key) on public.challenge_participants to authenticated;
grant update (habit_id, field_key) on public.challenge_participants to authenticated;
grant delete on public.challenge_participants to authenticated;

grant update (read_at) on public.notifications to authenticated;
grant delete on public.notifications to authenticated;

grant delete on public.push_subscriptions to authenticated;

-- Do not let future tables silently inherit broad grants.
alter default privileges in schema public revoke all on tables from anon, authenticated;
