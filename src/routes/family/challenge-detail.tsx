import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { motion, useReducedMotion } from 'motion/react'
import {
  CalendarDays, Heart, Link2, LogOut, MoreVertical, Pencil, PartyPopper, SearchX, Target, Trash2, UserPlus, Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { GlassCard } from '@/components/common/glass-card'
import { useOnline } from '@/components/common/offline-banner'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { ChallengeIcon } from '@/components/family/challenge-card'
import { formatChallengeDates } from '@/components/family/family-utils'
import { ChallengeProgressList } from '@/components/family/challenge-progress-list'
import { JoinChallengeDialog } from '@/components/family/join-challenge-dialog'
import {
  useChallenge, useChallengeParticipants, useChallengeProgress, useDeleteChallenge, useLeaveChallenge,
} from '@/hooks/use-challenges'
import { useMyFamily } from '@/hooks/use-family'
import { useHabits } from '@/hooks/use-habits'
import { todayISO } from '@/lib/dates'
import { toUserMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { useCurrentUser } from '@/providers/auth-provider'
import {
  challengeLengthDays, challengeStatus, combinedProgress, daysElapsed, describeMetric, formatAmount, reachedCount,
  timingLabel, type ChallengeStatus,
} from '@/domain/challenge'
import type { ChallengeProgress } from '@/api/challenges'
import type { ChallengeParticipant, FamilyChallenge } from '@/types/models'

const STATUS_BADGE: Record<ChallengeStatus, string> = { active: 'bg-mint', upcoming: 'bg-sky', finished: 'bg-lavender' }

/** /family/challenges/:id */
export default function ChallengeDetailPage() {
  const { id } = useParams()
  const challenge = useChallenge(id)
  const family = useMyFamily()
  const header = <PageHeader title="Challenge" back="/family/challenges" />

  if (challenge.isPending || family.isPending) {
    return (
      <div>
        {header}
        <LoadingState rows={4} />
      </div>
    )
  }
  if (challenge.error || family.error) {
    return (
      <div>
        {header}
        <ErrorState
          error={challenge.error ?? family.error}
          onRetry={() => {
            void challenge.refetch()
            void family.refetch()
          }}
        />
      </div>
    )
  }
  if (!challenge.data) {
    return (
      <div>
        {header}
        <EmptyState
          icon={SearchX}
          title="Challenge not found"
          description="It may have been deleted, or it belongs to a different family."
          action={
            <Button asChild className="h-11">
              <Link to="/family/challenges">All challenges</Link>
            </Button>
          }
        />
      </div>
    )
  }
  return <ChallengeDetails challenge={challenge.data} isAdmin={family.data?.myRole === 'admin'} />
}

function ChallengeDetails({ challenge, isAdmin }: { challenge: FamilyChallenge; isAdmin: boolean }) {
  const { userId } = useCurrentUser()
  const navigate = useNavigate()
  const online = useOnline()
  const today = todayISO()
  const status = challengeStatus(challenge, today)
  const participants = useChallengeParticipants(challenge.id)
  const progress = useChallengeProgress(challenge.id)
  const remove = useDeleteChallenge()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const canManage = challenge.created_by === userId || isAdmin
  const myParticipant = participants.data?.find((p) => p.user_id === userId) ?? null
  const length = challengeLengthDays(challenge)

  async function onDelete() {
    try {
      await remove.mutateAsync(challenge.id)
      toast.success('Challenge deleted')
      navigate('/family/challenges', { replace: true })
    } catch (e) {
      toast.error(toUserMessage(e))
    }
  }

  const manageMenu = canManage ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11 rounded-full" aria-label="Challenge options" disabled={!online}>
          <MoreVertical className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem className="min-h-11" onSelect={() => navigate(`/family/challenges/${challenge.id}/edit`)}>
          <Pencil aria-hidden /> Edit challenge
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11" variant="destructive" onSelect={() => setConfirmDelete(true)}>
          <Trash2 aria-hidden /> Delete challenge
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : undefined

  return (
    <div className="space-y-4">
      <PageHeader title={challenge.title} back="/family/challenges" action={manageMenu} />

      <GlassCard className="space-y-4">
        <div className="flex items-start gap-3">
          <ChallengeIcon challenge={challenge} />
          <div className="min-w-0 flex-1 space-y-1">
            <Badge className={cn('text-foreground', STATUS_BADGE[status])}>{timingLabel(challenge, today)}</Badge>
            {challenge.description ? <p className="text-sm break-words">{challenge.description}</p> : null}
          </div>
        </div>
        <dl className="grid gap-2 text-sm">
          <div className="flex items-center gap-2">
            <Target className="size-4 shrink-0 text-primary" aria-hidden />
            <dt className="sr-only">Target</dt>
            <dd>
              <span className="font-semibold">{formatAmount(challenge, Number(challenge.target))}</span> each ·{' '}
              <span className="text-muted-foreground">{describeMetric(challenge)}</span>
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden />
            <dt className="sr-only">Dates</dt>
            <dd>
              {formatChallengeDates(challenge)} <span className="text-muted-foreground">({length} {length === 1 ? 'day' : 'days'})</span>
            </dd>
          </div>
        </dl>
        {status === 'active' ? (
          <div className="space-y-1">
            <Progress value={(daysElapsed(challenge, today) / length) * 100} className="h-2" aria-label="Time elapsed" />
            <p className="text-xs text-muted-foreground">
              Day {daysElapsed(challenge, today)} of {length}
            </p>
          </div>
        ) : null}
      </GlassCard>

      {status === 'finished' && progress.data ? <FinishedCelebration challenge={challenge} rows={progress.data} /> : null}

      {status !== 'finished' ? (
        participants.isPending ? (
          <LoadingState rows={1} />
        ) : participants.error ? (
          <ErrorState error={participants.error} onRetry={() => void participants.refetch()} />
        ) : (
          <MyParticipation challenge={challenge} participant={myParticipant} />
        )
      ) : null}

      <section aria-labelledby="participants-title" className="space-y-3">
        <h2 id="participants-title" className="flex items-center gap-2 text-lg font-bold">
          <Users className="size-5 text-primary" aria-hidden /> {status === 'finished' ? 'Results' : 'Progress'}
        </h2>
        {progress.isPending ? (
          <LoadingState rows={2} />
        ) : progress.error ? (
          <ErrorState error={progress.error} onRetry={() => void progress.refetch()} />
        ) : progress.data.length === 0 ? (
          <GlassCard>
            <p className="text-sm text-muted-foreground">
              {status === 'finished' ? 'Nobody took part in this one — maybe next time!' : 'No one has joined yet. Be the first!'}
            </p>
          </GlassCard>
        ) : (
          <>
            <ChallengeProgressList challenge={challenge} rows={progress.data} myUserId={userId} />
            <p className="text-xs text-muted-foreground">Progress only counts habits members share with the family.</p>
          </>
        )}
      </section>

      {canManage ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Delete this challenge?"
          description="The challenge and everyone's participation will be removed. Habit entries are not affected."
          confirmLabel="Delete"
          onConfirm={onDelete}
        />
      ) : null}
    </div>
  )
}

function MyParticipation({ challenge, participant }: { challenge: FamilyChallenge; participant: ChallengeParticipant | null }) {
  const online = useOnline()
  const habits = useHabits()
  const leave = useLeaveChallenge()
  const [dialogOpen, setDialogOpen] = useState(false)
  const linkedHabit = participant ? habits.data?.find((h) => h.id === participant.habit_id) : undefined
  const linkedField = linkedHabit?.fields.find((f) => f.field_key === participant?.field_key)

  async function onLeave() {
    if (!participant) return
    try {
      await leave.mutateAsync(participant.id)
      toast.success('You left the challenge. You can rejoin any time.')
    } catch (e) {
      toast.error(toUserMessage(e))
    }
  }

  return (
    <GlassCard as="section" aria-labelledby="my-participation-title" className="space-y-3">
      <h2 id="my-participation-title" className="font-bold">
        {participant ? "You're taking part" : 'Want to join in?'}
      </h2>
      {participant ? (
        <>
          <p className="flex items-center gap-2 text-sm">
            <Link2 className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0">
              Counting <span className="font-semibold">{linkedHabit?.name ?? 'your linked habit'}</span>
              {linkedField ? (
                <span className="text-muted-foreground">
                  {' '}· {linkedField.label}
                  {linkedField.unit ? ` (${linkedField.unit})` : ''}
                </span>
              ) : null}
            </span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" className="h-11" disabled={!online} onClick={() => setDialogOpen(true)}>
              Change habit
            </Button>
            <ConfirmDialog
              title="Leave this challenge?"
              description="Your progress will no longer be shown. Your habit entries stay safe, and you can rejoin later."
              confirmLabel="Leave"
              onConfirm={onLeave}
              trigger={
                <Button variant="destructive" className="h-11 gap-1.5" disabled={!online || leave.isPending}>
                  <LogOut className="size-4" aria-hidden /> Leave
                </Button>
              }
            />
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Link one of your shared habits and your progress will count automatically as you track it.
          </p>
          <Button className="h-12 w-full gap-2" disabled={!online} onClick={() => setDialogOpen(true)}>
            <UserPlus className="size-5" aria-hidden /> Join challenge
          </Button>
        </>
      )}
      <JoinChallengeDialog challenge={challenge} participant={participant} open={dialogOpen} onOpenChange={setDialogOpen} />
    </GlassCard>
  )
}

function FinishedCelebration({ challenge, rows }: { challenge: FamilyChallenge; rows: ChallengeProgress[] }) {
  const reduceMotion = useReducedMotion()
  const reached = reachedCount(rows)
  const total = combinedProgress(rows)
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
    >
      <GlassCard className="space-y-2 bg-gradient-to-br from-lavender/50 via-peach/40 to-mint/40 text-center">
        <PartyPopper className="mx-auto size-10 text-primary" aria-hidden />
        <h2 className="text-xl font-extrabold">That's a wrap!</h2>
        {rows.length ? (
          <>
            <p className="text-sm">
              Together you logged <span className="font-bold">{formatAmount(challenge, total)}</span>
              {reached ? (
                <>
                  , and {reached} {reached === 1 ? 'person' : 'people'} reached the goal
                </>
              ) : null}
              .
            </p>
            <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <Heart className="size-4 text-rose" aria-hidden /> Thank you to everyone who took part — every step counts.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Thanks for setting this one up. Ready for the next challenge?</p>
        )}
      </GlassCard>
    </motion.div>
  )
}
