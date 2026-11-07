import { Link } from 'react-router'
import { PartyPopper } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { UserAvatar } from '@/components/common/user-avatar'
import { cn } from '@/lib/utils'
import { formatProgress, orderProgress } from '@/domain/challenge'
import type { ChallengeProgress } from '@/api/challenges'
import type { FamilyChallenge } from '@/types/models'

/** One row per participant: avatar, linked shared habit, progress bar and amount. */
export function ChallengeProgressList({
  challenge,
  rows,
  myUserId,
}: {
  challenge: FamilyChallenge
  rows: ChallengeProgress[]
  myUserId: string
}) {
  const ordered = orderProgress(rows)
  return (
    <ul className="space-y-3">
      {ordered.map((r) => {
        const reached = r.percent >= 100
        const isMe = r.userId === myUserId
        return (
          <li key={r.userId} className={cn('rounded-2xl p-3', isMe ? 'bg-lavender/40' : 'bg-glass')}>
            <div className="flex items-center gap-3">
              <Link
                to={`/family/members/${r.userId}`}
                className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-ring"
                aria-label={`Open ${r.displayName}'s page`}
              >
                <UserAvatar profile={{ display_name: r.displayName, avatar_url: r.avatarUrl, avatar_preset: r.avatarPreset }} />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {r.displayName}
                  {isMe ? <span className="font-normal text-muted-foreground"> (you)</span> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.habitName ? `Counting “${r.habitName}”` : 'Linked habit is no longer shared'}
                </p>
              </div>
              {reached ? (
                <span className="flex items-center gap-1 rounded-full bg-mint px-2 py-1 text-xs font-bold text-foreground">
                  <PartyPopper className="size-3.5" aria-hidden /> Goal reached
                </span>
              ) : null}
            </div>
            <Progress
              value={r.percent}
              className="mt-3 h-2.5 bg-muted"
              aria-label={`${r.displayName}: ${Math.round(r.percent)}% of the target`}
            />
            <p className="mt-1.5 flex justify-between gap-2 text-xs text-muted-foreground">
              <span>{formatProgress(challenge, r.progress, r.target || Number(challenge.target))}</span>
              <span className="font-semibold text-foreground">{Math.round(r.percent)}%</span>
            </p>
          </li>
        )
      })}
    </ul>
  )
}
