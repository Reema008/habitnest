import { Link, useSearchParams } from 'react-router'
import { CalendarClock, Flag, Plus, Sparkles, Trophy, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useOnline } from '@/components/common/offline-banner'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { ChallengeCard } from '@/components/family/challenge-card'
import { useChallenges, useMyChallengeParticipations } from '@/hooks/use-challenges'
import { useMyFamily } from '@/hooks/use-family'
import { todayISO } from '@/lib/dates'
import { challengeStatus, type ChallengeStatus } from '@/domain/challenge'
import type { FamilyChallenge } from '@/types/models'

const TABS: { value: ChallengeStatus; label: string; empty: string; hint: string; icon: LucideIcon }[] = [
  { value: 'active', label: 'Active', empty: 'No challenges running right now', hint: 'Start one and invite everyone to join in.', icon: Sparkles },
  { value: 'upcoming', label: 'Upcoming', empty: 'Nothing scheduled yet', hint: 'Plan a challenge that starts later.', icon: CalendarClock },
  { value: 'finished', label: 'Finished', empty: 'No finished challenges yet', hint: 'Completed challenges and their results show up here.', icon: Flag },
]

function isStatus(v: string | null): v is ChallengeStatus {
  return v === 'active' || v === 'upcoming' || v === 'finished'
}

/** /family/challenges — Active / Upcoming / Finished. */
export default function ChallengesPage() {
  const online = useOnline()
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab')
  const tab: ChallengeStatus = isStatus(tabParam) ? tabParam : 'active'
  const family = useMyFamily()
  const inFamily = !!family.data
  const challenges = useChallenges(inFamily)
  const mine = useMyChallengeParticipations(inFamily)
  const today = todayISO()

  const newButton = inFamily ? (
    online ? (
      <Button asChild className="h-11 gap-1.5">
        <Link to="/family/challenges/new">
          <Plus className="size-4" aria-hidden /> New
        </Link>
      </Button>
    ) : (
      <Button className="h-11 gap-1.5" disabled>
        <Plus className="size-4" aria-hidden /> New
      </Button>
    )
  ) : undefined
  const header = <PageHeader title="Challenges" subtitle="Friendly goals to do together" back="/family" action={newButton} />

  if (family.isPending) {
    return (
      <div>
        {header}
        <LoadingState rows={3} />
      </div>
    )
  }
  if (family.error) {
    return (
      <div>
        {header}
        <ErrorState error={family.error} onRetry={() => void family.refetch()} />
      </div>
    )
  }
  if (!inFamily) {
    return (
      <div>
        {header}
        <EmptyState
          icon={Users}
          title="Challenges are a family thing"
          description="Create or join a family to take on challenges together."
          action={
            <Button asChild className="h-11">
              <Link to="/family">Set up a family</Link>
            </Button>
          }
        />
      </div>
    )
  }

  const joined = new Set((mine.data ?? []).map((p) => p.challenge_id))
  const grouped: Record<ChallengeStatus, FamilyChallenge[]> = { active: [], upcoming: [], finished: [] }
  for (const c of challenges.data ?? []) grouped[challengeStatus(c, today)].push(c)
  // Active: ending soonest first; upcoming: starting soonest first; finished: most recent first.
  grouped.active.sort((a, b) => a.end_date.localeCompare(b.end_date))
  grouped.upcoming.sort((a, b) => a.start_date.localeCompare(b.start_date))
  grouped.finished.sort((a, b) => b.end_date.localeCompare(a.end_date))

  return (
    <div>
      {header}
      {challenges.isPending ? (
        <LoadingState rows={3} />
      ) : challenges.error ? (
        <ErrorState error={challenges.error} onRetry={() => void challenges.refetch()} />
      ) : (
        <Tabs
          value={tab}
          onValueChange={(v) => {
            if (isStatus(v)) setParams(v === 'active' ? {} : { tab: v }, { replace: true })
          }}
          className="gap-4"
        >
          <TabsList className="grid h-12 w-full grid-cols-3 rounded-2xl bg-glass p-1 group-data-horizontal/tabs:h-12">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="h-10 rounded-xl text-sm font-semibold">
                {t.label}
                {grouped[t.value].length ? <span className="text-xs text-muted-foreground">({grouped[t.value].length})</span> : null}
              </TabsTrigger>
            ))}
          </TabsList>
          {TABS.map((t) => (
            <TabsContent key={t.value} value={t.value}>
              {grouped[t.value].length ? (
                <ul className="space-y-3">
                  {grouped[t.value].map((c) => (
                    <ChallengeCard key={c.id} challenge={c} today={today} joined={joined.has(c.id)} />
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={t.value === 'finished' ? Trophy : t.icon}
                  title={t.empty}
                  description={t.hint}
                  action={
                    t.value !== 'finished' && online ? (
                      <Button asChild className="h-11 gap-1.5">
                        <Link to="/family/challenges/new">
                          <Plus className="size-4" aria-hidden /> Create a challenge
                        </Link>
                      </Button>
                    ) : undefined
                  }
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}
