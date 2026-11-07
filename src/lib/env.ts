/**
 * Validated public configuration. Only VITE_* values reach the browser bundle and all of them
 * are safe to publish (the Supabase publishable key is protected by RLS).
 * Never put service-role keys or other secrets in VITE_* variables.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export const env = {
  supabaseUrl: url ?? '',
  supabaseAnonKey: anonKey ?? '',
  /** Optional: enables Web Push reminders when set. */
  vapidPublicKey: vapidPublicKey ?? '',
  /** Internal, non-deliverable domain used to map usernames to Supabase Auth identities. */
  authEmailDomain: (import.meta.env.VITE_AUTH_EMAIL_DOMAIN as string | undefined) ?? 'users.habitnest.invalid',
} as const

export const envError: string | null =
  !url || !anonKey
    ? 'HabitNest is not configured. Copy .env.example to .env and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    : null
