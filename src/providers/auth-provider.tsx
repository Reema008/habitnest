import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/query-keys'
import { getMyProfile } from '@/api/profiles'
import type { Profile } from '@/types/models'

type AuthState = {
  session: Session | null
  userId: string | null
  profile: Profile | null
  /** True until the stored session has been restored. */
  initializing: boolean
  profileLoading: boolean
  /** True once the profile was fetched from the server in this session (not just restored from cache). */
  profileFresh: boolean
  profileError: unknown
  refetchProfile: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [initializing, setInitializing] = useState(true)
  const qc = useQueryClient()

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setInitializing(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'SIGNED_OUT') qc.clear() // never leak cached data to the next user
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [qc])

  const userId = session?.user.id ?? null
  const profileQuery = useQuery({
    queryKey: [...queryKeys.profile.me, userId],
    queryFn: () => getMyProfile(userId!),
    enabled: !!userId,
    // Always confirm against the server when the app opens; cached data only bridges offline use.
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const value = useMemo<AuthState>(
    () => ({
      session,
      userId,
      profile: profileQuery.data ?? null,
      initializing,
      profileLoading: !!userId && profileQuery.isPending,
      profileFresh: profileQuery.isFetchedAfterMount && !profileQuery.isFetching,
      profileError: profileQuery.error,
      refetchProfile: () => void profileQuery.refetch(),
    }),
    [session, userId, initializing, profileQuery],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** For screens rendered behind <RequireAuth>: the signed-in user's id and profile. */
export function useCurrentUser(): { userId: string; profile: Profile } {
  const { userId, profile } = useAuth()
  if (!userId || !profile) throw new Error('useCurrentUser used outside an authenticated route')
  return { userId, profile }
}
