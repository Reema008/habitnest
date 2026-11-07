import { Download, Share, SquarePlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { GlassCard } from '@/components/common/glass-card'
import { NestLogo } from '@/components/common/nest-logo'
import { Button } from '@/components/ui/button'
import { toUserMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { usePrefs } from '@/store/prefs'
import { promptInstall, useInstallState } from './install-state'

const DISMISS_KEY = 'install'

/**
 * "Install HabitNest" card. Shows the native prompt when the browser offers one, or
 * Share → Add to Home Screen instructions on iOS. Renders nothing once installed or dismissed.
 * Pass `dismissible={false}` to always show it (e.g. in Settings).
 */
export function InstallPrompt({ className, dismissible = true }: { className?: string; dismissible?: boolean }) {
  const state = useInstallState()
  const dismissed = usePrefs((s) => !!s.dismissed[DISMISS_KEY])
  const dismiss = usePrefs((s) => s.dismiss)

  if (state.installed || (dismissible && dismissed)) return null
  if (!state.canPrompt && !state.iosManual) return null

  const onInstall = async () => {
    try {
      const outcome = await promptInstall()
      if (outcome === 'accepted') toast.success('HabitNest is being added to your device 🎉')
    } catch (e) {
      toast.error(toUserMessage(e, 'The install prompt could not be opened.'))
    }
  }

  return (
    <GlassCard as="section" aria-labelledby="install-title" className={cn('relative flex gap-3', className)}>
      <NestLogo className="size-12 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2 pr-8">
        <h2 id="install-title" className="font-bold leading-tight">
          Install HabitNest
        </h2>
        {state.canPrompt ? (
          <>
            <p className="text-sm text-muted-foreground">
              Add it to your home screen for quick check-ins, offline access and reminders.
            </p>
            <Button className="h-11" onClick={() => void onInstall()}>
              <Download className="size-4" aria-hidden /> Install app
            </Button>
          </>
        ) : state.iosNeedsSafari ? (
          <p className="text-sm text-muted-foreground">
            Open this page in <strong>Safari</strong>, tap <Share className="inline size-4 align-text-bottom" aria-label="Share" />{' '}
            <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
          </p>
        ) : (
          <ol className="space-y-1 text-sm text-muted-foreground">
            <li className="flex items-center gap-1.5">
              1. Tap <Share className="size-4 shrink-0 text-primary" aria-hidden /> <strong>Share</strong> in Safari's toolbar
            </li>
            <li className="flex items-center gap-1.5">
              2. Choose <SquarePlus className="size-4 shrink-0 text-primary" aria-hidden /> <strong>Add to Home Screen</strong>
            </li>
          </ol>
        )}
      </div>
      {dismissible ? (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1.5 top-1.5 size-11 rounded-full"
          aria-label="Dismiss install suggestion"
          onClick={() => dismiss(DISMISS_KEY)}
        >
          <X className="size-5" aria-hidden />
        </Button>
      ) : null}
    </GlassCard>
  )
}
