import { BellOff, BellRing, Info, RefreshCw, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { useOnline } from '@/components/common/offline-banner'
import { isIOS, isStandalone } from '@/components/pwa/platform'
import { Button } from '@/components/ui/button'
import { isPushConfigured } from '@/api/push'
import { useDisablePush, useEnablePush, usePushStatus, useTestNotification } from '@/hooks/use-push'
import { toUserMessage } from '@/lib/errors'
import { SwitchRow } from './settings-section'

function Note({ icon: Icon = Info, children }: { icon?: typeof Info; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-xl bg-muted/70 p-3 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <div className="space-y-1">{children}</div>
    </div>
  )
}

/** "Notifications on this device" switch with platform-specific guidance. */
export function PushDeviceSetting() {
  const online = useOnline()
  const status = usePushStatus()
  const enable = useEnablePush()
  const disable = useDisablePush()
  const test = useTestNotification()

  const configured = isPushConfigured()
  const iosNeedsInstall = isIOS() && !isStandalone()
  const value = status.data
  const subscribed = value === 'subscribed'
  const busy = enable.isPending || disable.isPending
  const blocked = !configured || iosNeedsInstall || value === 'unsupported' || value === 'denied'

  const onToggle = (on: boolean) => {
    if (on) {
      enable.mutate(undefined, {
        onSuccess: () => toast.success('Notifications are on for this device'),
        onError: (e) => toast.error(toUserMessage(e)),
      })
    } else {
      disable.mutate(undefined, {
        onSuccess: () => toast.success('Notifications are off for this device'),
        onError: (e) => toast.error(toUserMessage(e)),
      })
    }
  }

  let note: React.ReactNode = null
  if (!configured) {
    note = <Note icon={BellOff}>Push reminders aren't configured yet. Reminders will start working once the app owner sets them up.</Note>
  } else if (iosNeedsInstall) {
    note = (
      <Note icon={Smartphone}>
        <p>
          On iPhone and iPad, notifications only work in the installed app (iOS 16.4 or later).
        </p>
        <p className="text-muted-foreground">
          In Safari tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>. Open HabitNest from your Home
          Screen and turn this on there.
        </p>
      </Note>
    )
  } else if (value === 'unsupported') {
    note = <Note icon={BellOff}>This browser can't show notifications. Try a recent version of Chrome, Edge, Firefox or Safari.</Note>
  } else if (value === 'denied') {
    note = (
      <Note icon={BellOff}>
        <p className="font-semibold">Notifications are blocked for HabitNest on this device.</p>
        <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
          <li>Android: tap the icon left of the address bar (or ⋮ → Settings → Site settings) → Notifications → Allow.</li>
          <li>iPhone / iPad: Settings → Notifications → HabitNest → Allow Notifications.</li>
          <li>Computer: click the icon left of the address bar → Notifications → Allow.</li>
        </ul>
        <Button variant="secondary" size="sm" className="mt-1 h-11" onClick={() => void status.refetch()}>
          <RefreshCw className="size-4" aria-hidden /> I've allowed them
        </Button>
      </Note>
    )
  } else if (status.isError) {
    note = <Note>{toUserMessage(status.error)}</Note>
  }

  return (
    <div className="space-y-3">
      <SwitchRow
        id="push-device"
        label="Notifications on this device"
        description={
          status.isPending
            ? 'Checking this device…'
            : subscribed
              ? 'Reminders will appear on this device.'
              : 'Turn on to receive reminders here.'
        }
        checked={subscribed}
        onCheckedChange={onToggle}
        disabled={blocked || busy || !online || status.isPending}
      />
      {note}
      {subscribed ? (
        <Button
          variant="secondary"
          className="h-11 w-full"
          disabled={test.isPending}
          onClick={() => test.mutate(undefined, { onError: (e) => toast.error(toUserMessage(e)) })}
        >
          <BellRing className="size-4" aria-hidden /> Send a test notification
        </Button>
      ) : null}
    </div>
  )
}
