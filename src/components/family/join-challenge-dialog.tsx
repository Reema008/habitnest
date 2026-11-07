import { useState } from 'react'
import { Link } from 'react-router'
import { Info } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { HabitIcon } from '@/components/common/habit-visuals'
import { useOnline } from '@/components/common/offline-banner'
import { ErrorState, LoadingState } from '@/components/common/states'
import { useHabits } from '@/hooks/use-habits'
import { useChangeChallengeHabit, useJoinChallenge } from '@/hooks/use-challenges'
import { toUserMessage } from '@/lib/errors'
import { eligibleHabitFields, optionKey } from '@/domain/challenge'
import type { ChallengeParticipant, FamilyChallenge } from '@/types/models'

/**
 * Pick one of my shared habits (and, for "Total amount" challenges, a number field in the
 * challenge unit) to join with — or to switch the habit linked to my participation.
 */
export function JoinChallengeDialog({
  challenge,
  participant,
  open,
  onOpenChange,
}: {
  challenge: FamilyChallenge
  /** My existing participation: the dialog then changes the linked habit. */
  participant?: ChallengeParticipant | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const online = useOnline()
  const habits = useHabits()
  const join = useJoinChallenge()
  const change = useChangeChallengeHabit()
  const options = eligibleHabitFields(challenge, habits.data ?? [])
  const currentKey = participant ? optionKey(participant.habit_id, participant.field_key) : null
  const [selected, setSelected] = useState<string | null>(null)
  const value = selected ?? currentKey ?? (options.length === 1 && options[0] ? optionKey(options[0].habit.id, options[0].field?.field_key) : '')
  const pending = join.isPending || change.isPending
  const chosen = options.find((o) => optionKey(o.habit.id, o.field?.field_key) === value)

  async function confirm() {
    if (!chosen) return
    const fieldKey = chosen.field?.field_key ?? null
    try {
      if (participant) {
        await change.mutateAsync({ participantId: participant.id, habitId: chosen.habit.id, fieldKey })
        toast.success(`Now counting “${chosen.habit.name}”`)
      } else {
        await join.mutateAsync({ challengeId: challenge.id, habitId: chosen.habit.id, fieldKey })
        toast.success(`You joined “${challenge.title}”. Have fun!`)
      }
      setSelected(null)
      onOpenChange(false)
    } catch (e) {
      toast.error(toUserMessage(e))
    }
  }

  const unitText = challenge.aggregation === 'sum' ? `a number field measured in “${challenge.unit ?? ''}”` : null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setSelected(null)
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">{participant ? 'Change linked habit' : 'Join this challenge'}</DialogTitle>
          <DialogDescription>
            {challenge.aggregation === 'sum'
              ? `Pick the shared habit whose ${challenge.unit ?? ''} should count.`
              : 'Pick the shared habit you want to complete each day.'}
          </DialogDescription>
        </DialogHeader>

        {habits.isPending ? (
          <LoadingState rows={2} />
        ) : habits.error ? (
          <ErrorState error={habits.error} onRetry={() => void habits.refetch()} />
        ) : options.length === 0 ? (
          <div className="space-y-3 rounded-2xl bg-sky/40 p-4 text-sm">
            <p className="flex gap-2 font-semibold">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> No matching habit yet
            </p>
            <p>
              To join, you need a habit that is <strong>shared with your family</strong>
              {unitText ? <> and has {unitText}</> : null}. You can share an existing habit or create a new one in Habits.
            </p>
            <Button asChild className="h-11 w-full">
              <Link to="/habits">Go to Habits</Link>
            </Button>
          </div>
        ) : (
          <RadioGroup value={value} onValueChange={setSelected} aria-label="Habit to count" className="gap-2">
            {options.map((o) => {
              const key = optionKey(o.habit.id, o.field?.field_key)
              const id = `join-opt-${key.replace(/[^a-zA-Z0-9-]/g, '-')}`
              return (
                <Label
                  key={key}
                  htmlFor={id}
                  className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-border bg-glass p-3 font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-lavender/40"
                >
                  <RadioGroupItem id={id} value={key} />
                  <HabitIcon icon={o.habit.icon} color={o.habit.color} className="size-9" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{o.habit.name}</span>
                    {o.field ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {o.field.label}
                        {o.field.unit ? ` (${o.field.unit})` : ''}
                      </span>
                    ) : null}
                  </span>
                  {key === currentKey ? <span className="text-xs font-semibold text-primary">Current</span> : null}
                </Label>
              )
            })}
          </RadioGroup>
        )}

        <DialogFooter className="mx-0 mb-0 rounded-none border-0 bg-transparent p-0">
          <DialogClose asChild>
            <Button type="button" variant="secondary" className="h-11">
              Cancel
            </Button>
          </DialogClose>
          {options.length > 0 ? (
            <Button
              type="button"
              className="h-11"
              disabled={!online || !chosen || pending || (!!participant && value === currentKey)}
              onClick={() => void confirm()}
            >
              {pending ? 'Saving…' : participant ? 'Use this habit' : 'Join challenge'}
            </Button>
          ) : null}
        </DialogFooter>
        {!online ? <p className="text-center text-xs text-muted-foreground">You're offline — reconnect to join.</p> : null}
      </DialogContent>
    </Dialog>
  )
}
