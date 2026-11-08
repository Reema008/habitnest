import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { FullScreenLoader } from '@/components/common/states'
import { AppShell, PlainShell } from '@/layouts/app-shell'
import { queryClient, queryPersister } from '@/lib/query-client'
import { AuthProvider } from '@/providers/auth-provider'
import { ThemeProvider } from '@/providers/theme-provider'
import { RedirectIfSignedIn, RequireAuth } from '@/routes/guards'
import { AppUpdatePrompt } from '@/components/pwa/app-update-prompt'

// Route modules are code-split. Each feature module owns its own nested <Routes>.
const SignInPage = lazy(() => import('@/routes/auth/sign-in'))
const SignUpPage = lazy(() => import('@/routes/auth/sign-up'))
const ChangePasswordPage = lazy(() => import('@/routes/auth/change-password'))
const OnboardingPage = lazy(() => import('@/routes/onboarding/onboarding'))
const HomePage = lazy(() => import('@/routes/home/dashboard'))
const HabitsRoutes = lazy(() => import('@/routes/habits'))
const TrackRoutes = lazy(() => import('@/routes/track'))
const ReportsRoutes = lazy(() => import('@/routes/reports'))
const FamilyRoutes = lazy(() => import('@/routes/family'))
const ProfileRoutes = lazy(() => import('@/routes/profile'))
const ScheduleRoutes = lazy(() => import('@/routes/schedule'))
const PetRoutes = lazy(() => import('@/routes/pet'))
const SettingsRoutes = lazy(() => import('@/routes/settings'))
const NotificationsRoutes = lazy(() => import('@/routes/notifications'))
const NotFoundPage = lazy(() => import('@/routes/not-found'))

export default function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: queryPersister, maxAge: 1000 * 60 * 60 * 24, buster: 'v1' }}
    >
      <ThemeProvider>
        <div className="app-orbs" aria-hidden>
          <span /><span /><span /><span /><span />
        </div>
        <TooltipProvider>
          <AuthProvider>
            <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <Suspense fallback={<FullScreenLoader />}>
                <Routes>
                  <Route index element={<Navigate to="/home" replace />} />

                  <Route element={<RedirectIfSignedIn />}>
                    <Route element={<PlainShell />}>
                      <Route path="sign-in" element={<SignInPage />} />
                      <Route path="sign-up" element={<SignUpPage />} />
                    </Route>
                  </Route>

                  <Route element={<RequireAuth allowUnonboarded />}>
                    <Route element={<PlainShell />}>
                      <Route path="change-password" element={<ChangePasswordPage />} />
                      <Route path="onboarding" element={<OnboardingPage />} />
                    </Route>
                  </Route>

                  <Route element={<RequireAuth />}>
                    <Route element={<AppShell />}>
                      <Route path="home" element={<HomePage />} />
                      <Route path="habits/*" element={<HabitsRoutes />} />
                      <Route path="track/*" element={<TrackRoutes />} />
                      <Route path="reports/*" element={<ReportsRoutes />} />
                      <Route path="family/*" element={<FamilyRoutes />} />
                      <Route path="profile/*" element={<ProfileRoutes />} />
                      <Route path="schedule/*" element={<ScheduleRoutes />} />
                      <Route path="pet/*" element={<PetRoutes />} />
                      <Route path="settings/*" element={<SettingsRoutes />} />
                      <Route path="notifications/*" element={<NotificationsRoutes />} />
                    </Route>
                  </Route>

                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
            <Toaster position="top-center" richColors closeButton />
            <AppUpdatePrompt />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  )
}
