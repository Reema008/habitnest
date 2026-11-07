import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { env } from './env'

/** The single Supabase client for the app (public key only; RLS protects all data). */
export const supabase = createClient<Database>(
  env.supabaseUrl || 'http://localhost:54321',
  env.supabaseAnonKey || 'missing-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // No email links are used, so never parse sessions from the URL.
      detectSessionInUrl: false,
      storageKey: 'habitnest-auth',
    },
  },
)
