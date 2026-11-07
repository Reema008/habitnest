import { NavLink, Outlet } from 'react-router'
import { ChartColumn, House, ListChecks, UserRound, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OfflineBanner } from '@/components/common/offline-banner'
import { SettingsSync } from '@/components/settings/settings-sync'

const TABS = [
  { to: '/home', label: 'Home', icon: House },
  { to: '/habits', label: 'Habits', icon: ListChecks },
  { to: '/family', label: 'Family', icon: Users },
  { to: '/reports', label: 'Reports', icon: ChartColumn },
  { to: '/profile', label: 'Profile', icon: UserRound },
] as const

/** Mobile-first shell: centred content column + bottom tab bar. */
export function AppShell() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <SettingsSync />
      <OfflineBanner />
      <main id="main" className="safe-top flex-1 px-4 pb-32 pt-2">
        <Outlet />
      </main>
      <nav
        aria-label="Main"
        className="glass safe-bottom fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-lg rounded-t-3xl border-b-0 px-2 pt-2"
      >
        <ul className="grid grid-cols-5">
          {TABS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-semibold text-muted-foreground transition-colors',
                    'focus-visible:outline-2 focus-visible:outline-ring',
                    isActive && 'bg-lavender/50 text-foreground',
                  )
                }
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

/** Shell for full-screen flows without tabs (auth, onboarding, editors). */
export function PlainShell() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <OfflineBanner />
      <main id="main" className="safe-top safe-bottom flex-1 px-4 pb-8 pt-2">
        <Outlet />
      </main>
    </div>
  )
}
