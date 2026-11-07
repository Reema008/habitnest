import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/providers/auth-provider'
import { ErrorState, FullScreenLoader } from '@/components/common/states'

/** Requires a session; also enforces forced password change and onboarding. */
export function RequireAuth({ allowUnonboarded = false }: { allowUnonboarded?: boolean }) {
  const { session, profile, initializing, profileLoading, profileError, refetchProfile } = useAuth()
  const location = useLocation()
  const here = `${location.pathname}${location.search}`

  if (initializing || profileLoading) return <FullScreenLoader />
  if (!session) return <Navigate to={`/sign-in?next=${encodeURIComponent(here)}`} replace />
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg p-4 pt-16">
        <ErrorState error={profileError} onRetry={refetchProfile} />
      </div>
    )
  }
  if (profile.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to={`/change-password?next=${encodeURIComponent(here)}`} replace />
  }
  if (!allowUnonboarded && !profile.onboarded_at) {
    return <Navigate to={`/onboarding?next=${encodeURIComponent(here)}`} replace />
  }
  return <Outlet />
}

/** Auth screens: bounce signed-in users to where they were going. */
export function RedirectIfSignedIn() {
  const { session, initializing } = useAuth()
  const location = useLocation()
  if (initializing) return <FullScreenLoader />
  if (session) return <Navigate to={safeNext(new URLSearchParams(location.search).get('next'))} replace />
  return <Outlet />
}

/** Only allow in-app relative redirects (prevents open-redirects via ?next=). */
export function safeNext(next: string | null | undefined, fallback = '/home'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return fallback
  return next
}
