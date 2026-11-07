import { useState } from 'react'
import { CheckCircle2, Info, LogOut, RefreshCw, Smartphone } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { NestLogo } from '@/components/common/nest-logo'
import { useOnline } from '@/components/common/offline-banner'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { useInstallState } from '@/components/pwa/install-state'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { signOut } from '@/api/auth'
import { unsubscribe } from '@/api/push'
import { toUserMessage } from '@/lib/errors'
import { version as APP_VERSION } from '../../../package.json'
import { SettingsSection } from './settings-section'

/** Short commit id injected by the deploy workflow (absent in local builds). */
const BUILD_ID = (import.meta.env.VITE_APP_BUILD as string | undefined)?.slice(0, 7)

function InstallStatus() {
  const state = useInstallState()
  if (state.installed) {
    return (
      <p className="flex items-center gap-2 text-sm font-semibold">
        <CheckCircle2 className="size-5 text-success" aria-hidden /> Installed on this device
      </p>
    )
  }
  if (state.canPrompt || state.iosManual) return <InstallPrompt dismissible={false} />
  return (
    <p className="text-sm text-muted-foreground">
      To install, open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home Screen</strong>.
    </p>
  )
}

function UpdateCheck() {
  const online = useOnline()
  const [checking, setChecking] = useState(false)
  const supported = import.meta.env.PROD && typeof navigator !== 'undefined' && 'serviceWorker' in navigator
  if (!supported) return null

  const onCheck = async () => {
    setChecking(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      if (!reg) {
        toast.info('Updates are checked automatically when the app starts.')
        return
      }
      await reg.update()
      // A found update is announced by the "new version" toast; otherwise reassure the user.
      if (!reg.installing && !reg.waiting) toast.success("You're on the latest version")
    } catch (e) {
      toast.error(toUserMessage(e, 'Could not check for updates.'))
    } finally {
      setChecking(false)
    }
  }

  return (
    <Button variant="secondary" className="h-11" disabled={!online || checking} onClick={() => void onCheck()}>
      <RefreshCw className={checking ? 'size-4 animate-spin' : 'size-4'} aria-hidden />
      {checking ? 'Checking…' : 'Check for updates'}
    </Button>
  )
}

/** Install status, about and sign out. */
export function AppSettings() {
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)

  const onSignOut = async () => {
    setSigningOut(true)
    try {
      // Stop this device receiving the account's reminders (best effort; works only online).
      if (navigator.onLine) await unsubscribe().catch(() => undefined)
      await signOut()
      navigate('/sign-in', { replace: true })
    } catch (e) {
      toast.error(toUserMessage(e))
      setSigningOut(false)
    }
  }

  return (
    <SettingsSection id="app" title="App" icon={Smartphone}>
      <InstallStatus />
      <Separator />
      <div className="flex items-center gap-3">
        <NestLogo className="size-12 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-bold">
            <Info className="size-4 text-primary" aria-hidden /> About HabitNest
          </p>
          <p className="text-sm text-muted-foreground">
            Version {APP_VERSION}
            {BUILD_ID ? ` (build ${BUILD_ID})` : ''} · Family habit tracking, together.
          </p>
        </div>
      </div>
      <UpdateCheck />
      <Separator />
      <div className="space-y-2">
        <Button variant="outline" className="h-12 w-full text-destructive" disabled={signingOut} onClick={() => void onSignOut()}>
          <LogOut className="size-5" aria-hidden /> {signingOut ? 'Signing out…' : 'Sign out'}
        </Button>
        <p className="text-center text-xs text-muted-foreground">Signing out also stops reminders on this device.</p>
      </div>
    </SettingsSection>
  )
}
