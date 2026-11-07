import { Eye, EyeOff, Lock, ShieldCheck, Users } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { HabitIcon } from '@/components/common/habit-visuals'
import { useOnline } from '@/components/common/offline-banner'
import { ErrorState, LoadingState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useHabits, useUpdateHabit } from '@/hooks/use-habits'
import { toUserMessage } from '@/lib/errors'
import type { HabitVisibility } from '@/types/models'
import { SettingsSection } from './settings-section'

function isVisibility(v: string): v is HabitVisibility {
  return v === 'private' || v === 'family'
}

/** Per-habit Private / Shared switches and a plain-language explanation of what family can see. */
export function PrivacySettings() {
  const online = useOnline()
  const habits = useHabits()
  const update = useUpdateHabit()

  const sharedCount = habits.data?.filter((h) => h.visibility === 'family').length ?? 0
  const total = habits.data?.length ?? 0

  const setVisibility = (id: string, name: string, visibility: HabitVisibility) =>
    update.mutate(
      { id, patch: { visibility } },
      {
        onSuccess: () =>
          toast.success(visibility === 'family' ? `“${name}” is now shared with family` : `“${name}” is now private`),
        onError: (e) => toast.error(toUserMessage(e)),
      },
    )

  return (
    <SettingsSection
      id="privacy"
      title="Privacy"
      icon={ShieldCheck}
      description={habits.data ? `${sharedCount} of ${total} habit${total === 1 ? '' : 's'} shared with family` : undefined}
    >
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-xl bg-mint/40 p-3">
          <p className="mb-1 flex items-center gap-1.5 font-semibold">
            <Eye className="size-4" aria-hidden /> Family can see
          </p>
          <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
            <li>Your name, avatar and pet</li>
            <li>Shared habits: name, icon, what you log each day (including notes), streaks and related badges</li>
            <li>Shared habits in leaderboards and challenges</li>
          </ul>
        </div>
        <div className="rounded-xl bg-lavender/40 p-3">
          <p className="mb-1 flex items-center gap-1.5 font-semibold">
            <EyeOff className="size-4" aria-hidden /> Family can't see
          </p>
          <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
            <li>Private habits — not even that they exist</li>
            <li>Anything you log for private habits, or badges earned from them</li>
            <li>Your schedule, reminders and settings</li>
          </ul>
        </div>
      </div>

      {habits.isPending ? (
        <LoadingState rows={3} />
      ) : habits.isError ? (
        <ErrorState error={habits.error} onRetry={() => void habits.refetch()} />
      ) : habits.data.length === 0 ? (
        <div className="space-y-2 rounded-xl bg-muted/60 p-4 text-center text-sm">
          <p>You don't have any habits yet.</p>
          <Button asChild variant="secondary" className="h-11">
            <Link to="/habits">Go to Habits</Link>
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border" aria-label="Habit visibility">
          {habits.data.map((h) => {
            const pending = update.isPending && update.variables?.id === h.id
            return (
              <li key={h.id} className="flex flex-wrap items-center gap-3 py-3">
                <HabitIcon icon={h.icon} color={h.color} />
                <div className="min-w-0 flex-1">
                  <p id={`habit-${h.id}-name`} className="truncate font-semibold">
                    {h.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {h.visibility === 'family' ? 'Shared with family' : 'Private — only you'}
                  </p>
                </div>
                <ToggleGroup
                  type="single"
                  value={h.visibility}
                  onValueChange={(v) => {
                    if (isVisibility(v) && v !== h.visibility) setVisibility(h.id, h.name, v)
                  }}
                  disabled={!online || pending}
                  variant="outline"
                  spacing={0}
                  aria-labelledby={`habit-${h.id}-name`}
                  className="shrink-0"
                >
                  <ToggleGroupItem
                    value="private"
                    className="h-11 gap-1 px-3 aria-checked:bg-lavender/60 data-[state=on]:bg-lavender/60"
                    aria-label={`Keep ${h.name} private`}
                  >
                    <Lock className="size-4" aria-hidden /> Private
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="family"
                    className="h-11 gap-1 px-3 aria-checked:bg-mint/70 data-[state=on]:bg-mint/70"
                    aria-label={`Share ${h.name} with family`}
                  >
                    <Users className="size-4" aria-hidden /> Shared
                  </ToggleGroupItem>
                </ToggleGroup>
              </li>
            )
          })}
        </ul>
      )}
      {!online ? <p className="text-sm text-muted-foreground">Reconnect to change who can see your habits.</p> : null}
    </SettingsSection>
  )
}
