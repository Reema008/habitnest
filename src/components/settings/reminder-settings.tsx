import { useEffect, useRef, useState } from 'react'
import { BellRing, Globe } from 'lucide-react'
import { toast } from 'sonner'
import { useOnline } from '@/components/common/offline-banner'
import { ErrorState, LoadingState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { usePushDevices } from '@/hooks/use-push'
import { useSettings, useUpdateSettings, useUpdateTimeZone } from '@/hooks/use-settings'
import { deviceTimeZone } from '@/lib/dates'
import { toUserMessage } from '@/lib/errors'
import { useCurrentUser } from '@/providers/auth-provider'
import { describeNextReminder, normalizeClockTime, timeZoneLabel } from '@/domain/reminders'
import type { SettingsUpdate } from '@/api/settings'
import { PushDeviceSetting } from './push-device-setting'
import { SettingsSection, SwitchRow } from './settings-section'

const SAVE_DELAY_MS = 800

/** Time input that saves (debounced) once a valid, changed time is entered. */
function TimeField({
  id,
  label,
  value,
  disabled,
  onCommit,
}: {
  id: string
  label: string
  value: string
  disabled?: boolean
  onCommit: (time: string) => void
}) {
  const saved = normalizeClockTime(value) ?? ''
  const [draft, setDraft] = useState(saved)
  const [lastSaved, setLastSaved] = useState(saved)
  if (saved !== lastSaved) {
    // Server value changed (save succeeded, rolled back, or refreshed): reflect it.
    setLastSaved(saved)
    setDraft(saved)
  }
  const commitRef = useRef(onCommit)
  useEffect(() => {
    commitRef.current = onCommit
  })

  const normalized = normalizeClockTime(draft)
  useEffect(() => {
    if (!normalized || normalized === saved || disabled) return
    const t = setTimeout(() => commitRef.current(normalized), SAVE_DELAY_MS)
    return () => clearTimeout(t)
  }, [normalized, saved, disabled])

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      <Input
        id={id}
        type="time"
        step={60}
        required
        className="h-12 w-40 text-base"
        value={draft}
        disabled={disabled}
        aria-invalid={!normalized}
        aria-describedby={!normalized ? `${id}-error` : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (normalized && normalized !== saved && !disabled) onCommit(normalized)
        }}
      />
      {!normalized ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          Choose a time.
        </p>
      ) : null}
    </div>
  )
}

function ReminderRow({
  id,
  label,
  description,
  enabled,
  time,
  timeZone,
  showZone,
  disabled,
  onToggle,
  onTime,
}: {
  id: string
  label: string
  description: string
  enabled: boolean
  time: string
  timeZone: string
  showZone: boolean
  disabled: boolean
  onToggle: (on: boolean) => void
  onTime: (time: string) => void
}) {
  const next = enabled ? describeNextReminder(time, timeZone) : null
  return (
    <div className="space-y-3">
      <SwitchRow id={id} label={label} description={description} checked={enabled} onCheckedChange={onToggle} disabled={disabled} />
      {enabled ? (
        <div className="space-y-2 rounded-xl bg-muted/50 p-3">
          <TimeField id={`${id}-time`} label="Time" value={time} disabled={disabled} onCommit={onTime} />
          {next ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Next reminder: {next}
              {showZone ? ` (${timeZoneLabel(timeZone)} time)` : ''}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function TimeZoneRow() {
  const { profile } = useCurrentUser()
  const online = useOnline()
  const update = useUpdateTimeZone()
  const device = deviceTimeZone()
  const differs = device !== profile.timezone

  return (
    <div className="flex gap-2 rounded-xl bg-muted/70 p-3 text-sm">
      <Globe className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1 space-y-2">
        <p>
          Reminder times use your time zone: <strong>{profile.timezone.replace(/_/g, ' ')}</strong>.
        </p>
        {differs ? (
          <>
            <p className="text-muted-foreground">This device is set to {device.replace(/_/g, ' ')}.</p>
            <Button
              variant="secondary"
              className="h-11"
              disabled={!online || update.isPending}
              onClick={() =>
                update.mutate(device, {
                  onSuccess: () => toast.success(`Time zone set to ${timeZoneLabel(device)}`),
                  onError: (e) => toast.error(toUserMessage(e)),
                })
              }
            >
              {update.isPending ? 'Updating…' : "Use this device's time zone"}
            </Button>
          </>
        ) : null}
      </div>
    </div>
  )
}

/** Daily + "not finished yet" reminders, time zone and this device's push subscription. */
export function ReminderSettings() {
  const { profile } = useCurrentUser()
  const online = useOnline()
  const settings = useSettings()
  const update = useUpdateSettings()
  const devices = usePushDevices()

  const save = (patch: SettingsUpdate, success?: string) =>
    update.mutate(patch, {
      onSuccess: () => {
        if (success) toast.success(success)
      },
      onError: (e) => toast.error(toUserMessage(e)),
    })

  const showZone = deviceTimeZone() !== profile.timezone
  const s = settings.data
  const anyEnabled = !!s && (s.daily_reminder_enabled || s.incomplete_reminder_enabled)

  return (
    <SettingsSection
      id="reminders"
      title="Reminders"
      icon={BellRing}
      description="Gentle nudges, never nagging. Turn on notifications on this device to receive them."
    >
      {settings.isPending ? (
        <LoadingState rows={2} />
      ) : settings.isError ? (
        <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
      ) : (
        <div className="space-y-4">
          <ReminderRow
            id="daily-reminder"
            label="Daily check-in reminder"
            description="A friendly nudge to log today's habits."
            enabled={settings.data.daily_reminder_enabled}
            time={settings.data.daily_reminder_time}
            timeZone={profile.timezone}
            showZone={showZone}
            disabled={!online}
            onToggle={(on) => save({ daily_reminder_enabled: on }, on ? 'Daily reminder on' : 'Daily reminder off')}
            onTime={(t) => save({ daily_reminder_time: t }, 'Reminder time saved')}
          />
          <Separator />
          <ReminderRow
            id="incomplete-reminder"
            label="Remind me if I haven't finished today's habits"
            description="Only sent when something is still left for today."
            enabled={settings.data.incomplete_reminder_enabled}
            time={settings.data.incomplete_reminder_time}
            timeZone={profile.timezone}
            showZone={showZone}
            disabled={!online}
            onToggle={(on) =>
              save({ incomplete_reminder_enabled: on }, on ? 'Unfinished-habits reminder on' : 'Unfinished-habits reminder off')
            }
            onTime={(t) => save({ incomplete_reminder_time: t }, 'Reminder time saved')}
          />
          <TimeZoneRow />
        </div>
      )}
      <Separator />
      <PushDeviceSetting />
      {anyEnabled && devices.data && devices.data.length === 0 ? (
        <p role="status" className="rounded-xl bg-lemon/60 p-3 text-sm">
          Reminders are delivered as notifications. Turn on notifications on at least one device to receive them.
        </p>
      ) : null}
      {devices.data && devices.data.length > 1 ? (
        <p className="text-sm text-muted-foreground">Reminders go to {devices.data.length} of your devices.</p>
      ) : null}
    </SettingsSection>
  )
}
