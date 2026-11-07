import { useState } from 'react'
import { Link } from 'react-router'
import { Flame, Lock, Trophy, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { GlassCard } from '@/components/common/glass-card'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { UserAvatar } from '@/components/common/user-avatar'
import { formatPercent } from '@/components/charts/chart-format'
import { PeriodKindToggle, PeriodNavigator } from '@/components/reports/period-navigator'
import { periodRange, type PeriodKind } from '@/components/reports/period'
import { rankMembers, type RankedMember } from '@/domain/report-aggregates'
import type { LeaderboardRow } from '@/api/reports'
import { useMyFamily } from '@/hooks/use-family'
import { useFamilyLeaderboard } from '@/hooks/use-reports'
import { todayISO } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { useCurrentUser } from '@/providers/auth-provider'

const KINDS: readonly PeriodKind[] = ['week', 'month']

/** /family/leaderboard — friendly consistency ranking built from shared habits only. */
export default function FamilyLeaderboardPage() {
  const today = todayISO()
  const { userId } = useCurrentUser()
  const [kind, setKind] = useState<PeriodKind>('week')
  const [anchor, setAnchor] = useState(today)
  const range = periodRange(kind, anchor)
  const family = useMyFamily()
  const board = useFamilyLeaderboard(range.start, range.end, { enabled: !!family.data })

  let content: React.ReactNode
  if (family.error) content = <ErrorState error={family.error} onRetry={() => void family.refetch()} />
  else if (family.isPending) content = <LoadingState rows={4} />
  else if (!family.data) {
    content = (
      <EmptyState
        icon={Users}
        title="Cheer each other on"
        description="Create or join a family to see how everyone's shared habits are going."
        action={
          <Button asChild className="h-11 rounded-xl">
            <Link to="/family">Go to family</Link>
          </Button>
        }
      />
    )
  } else if (board.error) content = <ErrorState error={board.error} onRetry={() => void board.refetch()} />
  else if (board.isPending) content = <LoadingState rows={4} />
  else {
    const ranked = rankMembers(board.data)
    content = ranked.some((r) => r.rank !== null) ? (
      <ol className="space-y-2" aria-label="Family consistency ranking">
        {ranked.map((r) => (
          <LeaderboardItem key={r.row.userId} entry={r} isMe={r.row.userId === userId} />
        ))}
      </ol>
    ) : (
      <div className="space-y-2">
        <EmptyState
          icon={Trophy}
          title="Nothing to rank yet"
          description="When members share habits and have days scheduled in this period, everyone's consistency appears here."
        />
        {ranked.length ? (
          <ul className="space-y-2" aria-label="Family members">
            {ranked.map((r) => (
              <LeaderboardItem key={r.row.userId} entry={r} isMe={r.row.userId === userId} />
            ))}
          </ul>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-6">
      <PageHeader title="Leaderboard" subtitle="Consistency on shared habits" back="/family" />
      <PeriodKindToggle value={kind} options={KINDS} onChange={setKind} label="Leaderboard period" />
      <PeriodNavigator kind={kind} anchor={anchor} today={today} onChange={setAnchor} />
      {content}
      <GlassCard className="flex items-start gap-3 text-sm">
        <Lock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <p className="text-muted-foreground">
          Consistency counts completed days out of scheduled days on shared habits only. Private habits are never included.
        </p>
      </GlassCard>
    </div>
  )
}

function LeaderboardItem({ entry, isMe }: { entry: RankedMember<LeaderboardRow>; isMe: boolean }) {
  const { row, rank, title } = entry
  const profile = { display_name: row.displayName, avatar_url: row.avatarUrl, avatar_preset: row.avatarPreset }
  const name = isMe ? `${row.displayName} (you)` : row.displayName
  return (
    <GlassCard as="li" className={cn('flex items-center gap-3', isMe && 'ring-2 ring-primary/40')}>
      <div className="flex w-8 shrink-0 justify-center" aria-hidden={rank === null}>
        {rank !== null ? (
          rank === 1 ? (
            <span className="flex size-8 items-center justify-center rounded-full bg-lemon" title="Top of the nest">
              <Trophy className="size-4 text-foreground/80" aria-hidden />
              <span className="sr-only">Rank 1</span>
            </span>
          ) : (
            <span className="text-lg font-extrabold tabular-nums text-muted-foreground">
              <span className="sr-only">Rank </span>
              {rank}
            </span>
          )
        ) : null}
      </div>
      <UserAvatar profile={profile} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate font-semibold">{name}</p>
          {row.consistency !== null ? (
            <p className="shrink-0 text-lg font-extrabold tabular-nums">{formatPercent(row.consistency)}</p>
          ) : null}
        </div>
        <p className="text-xs font-semibold text-primary">{title}</p>
        {row.consistency !== null ? (
          <>
            <Progress value={row.consistency} aria-label={`${row.displayName} consistency`} className="h-1.5" />
            <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              <span>
                {row.completedDays} of {row.scheduledDays} scheduled days
              </span>
              {row.bestCurrentStreak > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Flame className="size-3" aria-hidden /> {row.bestCurrentStreak}-day streak
                </span>
              ) : null}
            </p>
          </>
        ) : row.sharedHabits > 0 ? (
          <p className="text-xs text-muted-foreground">
            {row.sharedHabits} shared {row.sharedHabits === 1 ? 'habit' : 'habits'} · no days scheduled in this period
          </p>
        ) : null}
      </div>
    </GlassCard>
  )
}
