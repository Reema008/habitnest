-- HabitNest: function privileges. Postgres grants EXECUTE to PUBLIC by default and Supabase
-- additionally grants it to anon/authenticated, so lock everything down and re-grant only
-- the functions the app is meant to call.
revoke execute on all functions in schema public from public, anon, authenticated;

-- Used inside RLS policies, SECURITY INVOKER functions and non-definer triggers.
grant execute on function
  public.my_family_id(),
  public.is_family_admin(uuid),
  public.shares_family_with(uuid),
  public.can_view_habit(uuid),
  public.is_valid_timezone(text),
  public.habit_streak(uuid)
to authenticated;

-- Client RPCs.
grant execute on function
  public.ack_password_changed(),
  public.create_family(text),
  public.create_invitation(integer, integer),
  public.preview_invitation(text),
  public.join_family(text),
  public.leave_family(),
  public.remove_family_member(uuid),
  public.set_family_member_role(uuid, public.family_role),
  public.create_habit(jsonb, jsonb, jsonb),
  public.save_habit_fields(uuid, jsonb, jsonb),
  public.register_push_subscription(text, text, text, text),
  public.family_leaderboard(date, date),
  public.family_metric_series(date, date),
  public.challenge_progress(uuid)
to authenticated;

-- The sign-up form checks availability before an account exists.
grant execute on function public.username_available(text) to anon, authenticated;

-- Server jobs (Edge Functions use the service role).
grant execute on function
  public.claim_due_reminders(timestamptz, interval),
  public.get_reminder_secrets()
to service_role;

alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
