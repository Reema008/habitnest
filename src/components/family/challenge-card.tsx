import { Link } from 'react-router'
import { CalendarDays, CheckCircle2, ChevronRight, Footprints, Target } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { GlassCard } from '@/components/common/glass-card'
import type { ISODate } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { challengeStatus, describeMetric, formatAmount, timingLabel, type ChallengeStatus } from '@/domain/challenge'
import type { FamilyChallenge } from '@/types/models'
import { formatChallengeDates } from './family-utils'

const STATUS_STYLE: Record<ChallengeStatus, string> = {
  active: 'bg-mint',
  upcoming: 'bg-sky',
  finished: 'bg-lavender',
}

export function ChallengeIcon({ challenge, className }: { challenge: Pick<FamilyChallenge, 'aggregation'>; className?: string }) {
  const Icon = challenge.aggregation === 'sum' ? Footprints : CalendarDays
  return (
    <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-2xl', challenge.aggregation === 'sum' ? 'bg-peach' : 'bg-mint', className)}>
      <Icon className="size-5 text-foreground/80" aria-hidden />
    </span>
  )
}

/** Challenge summary row for lists. */
export function ChallengeCard({ challenge, today, joined }: { challenge: FamilyChallenge; today: ISODate; joined: boolean }) {
  const status = challengeStatus(challenge, today)
  return (
    <GlassCard as="li" className="p-0">
      <Link
        to={`/family/challenges/${challenge.id}`}
        className="flex items-start gap-3 rounded-2xl p-4 transition hover:bg-lavender/20 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ChallengeIcon challenge={challenge} />
        <span className="min-w-0 flex-1 space-y-1">
          <span className="block truncate font-bold">{challenge.title}</span>
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Target className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {formatAmount(challenge, Number(challenge.target))} · {describeMetric(challenge)}
            </span>
          </span>
          <span className="block text-xs text-muted-foreground">{formatChallengeDates(challenge)}</span>
          <span className="flex flex-wrap gap-1.5 pt-1">
            <Badge className={cn('text-foreground', STATUS_STYLE[status])}>{timingLabel(challenge, today)}</Badge>
            {joined ? (
              <Badge variant="secondary" className="bg-lemon/70 text-foreground">
                <CheckCircle2 aria-hidden /> You're in
              </Badge>
            ) : null}
          </span>
        </span>
        <ChevronRight className="mt-3 size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </GlassCard>
  )
}
