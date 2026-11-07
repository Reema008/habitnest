import { Link } from 'react-router'
import { ChevronRight, Eye, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/common/glass-card'
import { HabitIcon } from '@/components/common/habit-visuals'
import { ErrorState, LoadingState } from '@/components/common/states'
import { UserAvatar } from '@/components/common/user-avatar'
import { useHabits, useSharedFamilyHabits } from '@/hooks/use-habits'
import type { FamilyMemberWithProfile, HabitWithFields } from '@/types/models'

function HabitChip({ habit }: { habit: HabitWithFields }) {
  return (
    <li className="flex min-h-11 items-center gap-3">
      <HabitIcon icon={habit.icon} color={habit.color} className="size-9" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{habit.name}</span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Eye className="size-3" aria-hidden /> Shared with family
        </span>
      </span>
    </li>
  )
}

/** "Shared habits": mine that I share + those other members share. Private habits never appear. */
export function SharedHabitsSection({ members, myUserId }: { members: FamilyMemberWithProfile[]; myUserId: string }) {
  const mine = useHabits()
  const others = useSharedFamilyHabits()
  const mySharedHabits = (mine.data ?? []).filter((h) => h.visibility === 'family')

  const byOwner = new Map<string, HabitWithFields[]>()
  for (const h of others.data ?? []) {
    const list = byOwner.get(h.owner_id) ?? []
    list.push(h)
    byOwner.set(h.owner_id, list)
  }
  const otherMembers = members.filter((m) => m.user_id !== myUserId)

  return (
    <section aria-labelledby="shared-habits-title" className="space-y-3">
      <div>
        <h2 id="shared-habits-title" className="text-lg font-bold">Shared habits</h2>
        <p className="text-sm text-muted-foreground">Only habits members choose to share appear here.</p>
      </div>

      <GlassCard className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">Yours</h3>
          <Button asChild variant="ghost" className="h-11 gap-1.5 text-primary">
            <Link to="/habits">
              <Settings2 className="size-4" aria-hidden /> Manage sharing
            </Link>
          </Button>
        </div>
        {mine.isPending ? (
          <LoadingState rows={1} />
        ) : mine.error ? (
          <ErrorState error={mine.error} onRetry={() => void mine.refetch()} />
        ) : mySharedHabits.length ? (
          <ul className="space-y-2">
            {mySharedHabits.map((h) => (
              <HabitChip key={h.id} habit={h} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            You aren't sharing any habits yet. Open a habit in <Link to="/habits" className="font-semibold text-primary underline-offset-4 hover:underline">Habits</Link> and
            choose “Shared with family” to let everyone cheer you on.
          </p>
        )}
      </GlassCard>

      {others.isPending ? (
        <LoadingState rows={1} />
      ) : others.error ? (
        <ErrorState error={others.error} onRetry={() => void others.refetch()} />
      ) : otherMembers.length === 0 ? (
        <GlassCard>
          <p className="text-sm text-muted-foreground">When others join your family, the habits they share will show up here.</p>
        </GlassCard>
      ) : (
        otherMembers.map((m) => {
          const habits = byOwner.get(m.user_id) ?? []
          return (
            <GlassCard key={m.user_id} className="space-y-3">
              <Link
                to={`/family/members/${m.user_id}`}
                className="-m-1 flex min-h-11 items-center gap-3 rounded-xl p-1 transition hover:bg-lavender/30 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <UserAvatar profile={m.profile} className="size-9" />
                <span className="min-w-0 flex-1 truncate font-semibold">{m.profile.display_name}</span>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
              {habits.length ? (
                <ul className="space-y-2">
                  {habits.map((h) => (
                    <HabitChip key={h.id} habit={h} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Not sharing any habits yet.</p>
              )}
            </GlassCard>
          )
        })
      )}
    </section>
  )
}
