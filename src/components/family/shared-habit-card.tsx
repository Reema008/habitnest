import { useState } from 'react'
import { Eye, Flame, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { GlassCard } from '@/components/common/glass-card'
import { HabitIcon } from '@/components/common/habit-visuals'
import { ErrorState } from '@/components/common/states'
import { useHabitEntries } from '@/hooks/use-entries'
import { WEEKDAY_SHORT } from '@/lib/dates'
import type { FieldDefinition, HabitWithFields } from '@/types/models'
import { EntryValues } from './entry-values'

const INITIAL_ENTRIES = 3
const MORE_ENTRIES = 14

function frequencyText(days: number[]): string {
  if (days.length === 7) return 'Every day'
  if (days.length === 0) return 'No days scheduled'
  return [...days].sort((a, b) => a - b).map((d) => WEEKDAY_SHORT[d] ?? '').join(', ')
}

function StreakValue({ value, pending }: { value: number | undefined; pending: boolean }) {
  if (value !== undefined) return <p className="font-bold">{value} {value === 1 ? 'day' : 'days'}</p>
  if (pending) return <Skeleton className="h-5 w-12" />
  return <p className="font-bold text-muted-foreground">–</p>
}

/** A family-shared habit with streaks and its most recent entries. */
export function SharedHabitCard({
  habit,
  streak,
  streakPending,
  definitions,
}: {
  habit: HabitWithFields
  streak: { current: number; best: number } | undefined
  streakPending: boolean
  definitions: FieldDefinition[]
}) {
  const entries = useHabitEntries(habit.id)
  const [expanded, setExpanded] = useState(false)
  const all = entries.data ?? []
  const visible = all.slice(0, expanded ? MORE_ENTRIES : INITIAL_ENTRIES)

  return (
    <GlassCard as="article" className="space-y-3" aria-labelledby={`habit-${habit.id}-name`}>
      <div className="flex items-start gap-3">
        <HabitIcon icon={habit.icon} color={habit.color} />
        <div className="min-w-0 flex-1">
          <h3 id={`habit-${habit.id}-name`} className="truncate font-bold">
            {habit.name}
          </h3>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Eye className="size-3" aria-hidden /> Shared with family · {frequencyText(habit.frequency_days)}
          </p>
        </div>
      </div>
      {habit.description ? <p className="text-sm text-muted-foreground">{habit.description}</p> : null}

      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 rounded-xl bg-peach/40 p-2">
          <Flame className="size-5 text-foreground/80" aria-hidden />
          <div>
            <p className="text-xs text-muted-foreground">Current streak</p>
            <StreakValue value={streak?.current} pending={streakPending} />
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-lemon/40 p-2">
          <Trophy className="size-5 text-foreground/80" aria-hidden />
          <div>
            <p className="text-xs text-muted-foreground">Best streak</p>
            <StreakValue value={streak?.best} pending={streakPending} />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Recent entries</h4>
        {entries.isPending ? (
          <Skeleton className="h-16 w-full rounded-xl" />
        ) : entries.error ? (
          <ErrorState error={entries.error} onRetry={() => void entries.refetch()} />
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">No entries yet.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {visible.map((e) => (
              <li key={e.id} className="py-2 first:pt-0 last:pb-0">
                <EntryValues entry={e} definitions={definitions} />
              </li>
            ))}
          </ul>
        )}
        {all.length > INITIAL_ENTRIES ? (
          <Button variant="ghost" className="h-11 w-full text-primary" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
            {expanded ? 'Show fewer' : 'Show more entries'}
          </Button>
        ) : null}
      </div>
    </GlassCard>
  )
}
