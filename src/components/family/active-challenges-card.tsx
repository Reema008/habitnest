import { Link } from 'react-router'
import { ChevronRight, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { GlassCard } from '@/components/common/glass-card'
import { useChallengeProgressMany, useChallenges, useMyChallengeParticipations } from '@/hooks/use-challenges'
import { useMyFamily } from '@/hooks/use-family'
import { todayISO } from '@/lib/dates'
import { challengeStatus, formatProgress, timingLabel } from '@/domain/challenge'
import { useCurrentUser } from '@/providers/auth-provider'
import { ChallengeIcon } from './challenge-card'

const MAX_SHOWN = 3

/**
 * Dashboard card: my family's active challenges with my progress (or a Join call to action).
 * Renders nothing when I'm not in a family or there are no active challenges.
 */
export function ActiveChallengesCard() {
  const { userId } = useCurrentUser()
  const family = useMyFamily()
  const inFamily = !!family.data
  const challenges = useChallenges(inFamily)
  const mine = useMyChallengeParticipations(inFamily)
  const today = todayISO()

  const active = (challenges.data ?? []).filter((c) => challengeStatus(c, today) === 'active')
  const shown = active.slice(0, MAX_SHOWN)
  const joinedIds = new Set((mine.data ?? []).map((p) => p.challenge_id))
  const progressIds = shown.filter((c) => joinedIds.has(c.id)).map((c) => c.id)
  const progress = useChallengeProgressMany(progressIds)

  if (!inFamily || challenges.error || mine.error) return null
  if (challenges.isPending || mine.isPending) {
    return <Skeleton className="h-28 w-full rounded-2xl bg-glass" aria-label="Loading family challenges" />
  }
  if (active.length === 0) return null

  return (
    <GlassCard as="section" aria-labelledby="active-challenges-title" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="active-challenges-title" className="flex items-center gap-2 text-base font-bold">
          <Trophy className="size-5 text-primary" aria-hidden /> Family challenges
        </h2>
        <Button asChild variant="ghost" className="h-11 gap-1 text-primary">
          <Link to="/family/challenges">
            See all <ChevronRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
      <ul className="space-y-2">
        {shown.map((c) => {
          const joined = joinedIds.has(c.id)
          const myRow = progress.data[c.id]?.find((r) => r.userId === userId)
          return (
            <li key={c.id}>
              <Link
                to={`/family/challenges/${c.id}`}
                className="flex min-h-14 items-center gap-3 rounded-2xl bg-glass p-3 transition hover:bg-lavender/30 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <ChallengeIcon challenge={c} className="size-10" />
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold">{c.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{timingLabel(c, today)}</span>
                  </span>
                  {joined ? (
                    myRow ? (
                      <>
                        <Progress value={myRow.percent} className="h-2" aria-label={`Your progress: ${Math.round(myRow.percent)}%`} />
                        <span className="block text-xs text-muted-foreground">
                          {formatProgress(c, myRow.progress, myRow.target || Number(c.target))}
                        </span>
                      </>
                    ) : progress.isPending ? (
                      <Skeleton className="h-2 w-full" aria-label="Loading your progress" />
                    ) : (
                      <span className="block text-xs text-muted-foreground">You're taking part — tap to see progress</span>
                    )
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                      Join
                    </span>
                  )}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
      {active.length > MAX_SHOWN ? (
        <p className="text-center text-xs text-muted-foreground">+{active.length - MAX_SHOWN} more active</p>
      ) : null}
    </GlassCard>
  )
}
