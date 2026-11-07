import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { format, parseISO } from 'date-fns'
import { Crown, Eye, ShieldCheck, UserMinus, UserRound, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { GlassCard } from '@/components/common/glass-card'
import { HABIT_ICONS } from '@/components/common/habit-visuals'
import { useOnline } from '@/components/common/offline-banner'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { UserAvatar } from '@/components/common/user-avatar'
import { ResetPasswordDialog } from '@/components/family/reset-password-dialog'
import { RoleBadge } from '@/components/family/role-badge'
import { SharedHabitCard } from '@/components/family/shared-habit-card'
import { useUserBadges } from '@/hooks/use-achievements'
import { useMyFamily, useRemoveMember, useSetMemberRole } from '@/hooks/use-family'
import { useFieldDefinitions, useHabits, useHabitStreaks, useSharedFamilyHabits } from '@/hooks/use-habits'
import { toUserMessage } from '@/lib/errors'
import { useCurrentUser } from '@/providers/auth-provider'
import type { FamilyMemberWithProfile, HabitWithFields } from '@/types/models'

/** /family/members/:userId — a family member's badges and shared habits (+ admin actions). */
export default function MemberPage() {
  const { userId: memberId } = useParams()
  const family = useMyFamily()
  const header = <PageHeader title="Family member" back="/family" />

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
  const member = family.data?.members.find((m) => m.user_id === memberId)
  if (!family.data || !member) {
    return (
      <div>
        {header}
        <EmptyState
          icon={UserX}
          title="Member not found"
          description="This person isn't in your family (any more)."
          action={
            <Button asChild className="h-11">
              <Link to="/family">Back to family</Link>
            </Button>
          }
        />
      </div>
    )
  }
  return <MemberDetails member={member} amAdmin={family.data.myRole === 'admin'} adminCount={family.data.members.filter((m) => m.role === 'admin').length} />
}

function MemberDetails({ member, amAdmin, adminCount }: { member: FamilyMemberWithProfile; amAdmin: boolean; adminCount: number }) {
  const { userId } = useCurrentUser()
  const isMe = member.user_id === userId
  const name = member.profile.display_name

  return (
    <div className="space-y-5">
      <PageHeader title={isMe ? 'You' : name} back="/family" />

      <GlassCard className="flex flex-col items-center gap-3 p-6 text-center">
        <UserAvatar profile={member.profile} className="size-24 text-4xl" />
        <div className="space-y-1">
          <h2 className="text-2xl font-extrabold break-words">{name}</h2>
          <div className="flex justify-center">
            <RoleBadge role={member.role} />
          </div>
          <p className="text-xs text-muted-foreground">In the family since {format(parseISO(member.joined_at), 'd MMM yyyy')}</p>
        </div>
        {isMe ? (
          <Button asChild variant="secondary" className="h-11 gap-2">
            <Link to="/profile">
              <UserRound className="size-4" aria-hidden /> Edit my profile
            </Link>
          </Button>
        ) : null}
      </GlassCard>

      {amAdmin && !isMe ? <AdminActions member={member} adminCount={adminCount} /> : null}

      <BadgesSection memberId={member.user_id} isMe={isMe} />

      <MemberSharedHabits member={member} isMe={isMe} />
    </div>
  )
}

function AdminActions({ member, adminCount }: { member: FamilyMemberWithProfile; adminCount: number }) {
  const online = useOnline()
  const navigate = useNavigate()
  const setRole = useSetMemberRole()
  const remove = useRemoveMember()
  const name = member.profile.display_name
  const isAdmin = member.role === 'admin'

  async function toggleRole() {
    try {
      await setRole.mutateAsync({ userId: member.user_id, role: isAdmin ? 'member' : 'admin' })
      toast.success(isAdmin ? `${name} is now a member` : `${name} is now an admin`)
    } catch (e) {
      toast.error(toUserMessage(e))
    }
  }

  async function onRemove() {
    try {
      await remove.mutateAsync(member.user_id)
      toast.success(`${name} was removed from the family`)
      navigate('/family', { replace: true })
    } catch (e) {
      toast.error(toUserMessage(e))
    }
  }

  return (
    <GlassCard as="section" aria-labelledby="admin-actions-title" className="space-y-3">
      <div>
        <h2 id="admin-actions-title" className="flex items-center gap-2 font-bold">
          <ShieldCheck className="size-4 text-primary" aria-hidden /> Admin actions
        </h2>
        <p className="text-xs text-muted-foreground">Only family admins see these options.</p>
      </div>
      <div className="grid gap-2">
        <Button
          variant="secondary"
          className="h-11 w-full justify-start gap-2"
          disabled={!online || setRole.isPending || (isAdmin && adminCount <= 1)}
          onClick={() => void toggleRole()}
        >
          <Crown className="size-4" aria-hidden />
          {setRole.isPending ? 'Saving…' : isAdmin ? 'Make member' : 'Make admin'}
        </Button>
        <ResetPasswordDialog userId={member.user_id} displayName={name} />
        <ConfirmDialog
          title={`Remove ${name} from the family?`}
          description={`${name} will no longer see the family's shared habits or challenges, and will leave any challenges they joined. Their own habits and data stay with them.`}
          confirmLabel="Remove"
          onConfirm={onRemove}
          trigger={
            <Button variant="destructive" className="h-11 w-full justify-start gap-2" disabled={!online || remove.isPending}>
              <UserMinus className="size-4" aria-hidden /> {remove.isPending ? 'Removing…' : 'Remove from family'}
            </Button>
          }
        />
      </div>
    </GlassCard>
  )
}

function BadgesSection({ memberId, isMe }: { memberId: string; isMe: boolean }) {
  const badges = useUserBadges(memberId)
  return (
    <section aria-labelledby="badges-title" className="space-y-3">
      <h2 id="badges-title" className="text-lg font-bold">Badges</h2>
      {badges.isPending ? (
        <LoadingState rows={1} />
      ) : badges.error ? (
        <ErrorState error={badges.error} onRetry={badges.refetch} />
      ) : !badges.data?.length ? (
        <GlassCard>
          <p className="text-sm text-muted-foreground">
            {isMe ? 'No badges yet — they’ll appear as you build your habits.' : 'No badges to show yet. Every journey starts somewhere!'}
          </p>
        </GlassCard>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {badges.data.map((b) => {
            const Icon = HABIT_ICONS[b.achievement.icon] ?? HABIT_ICONS.sparkles!
            return (
              <li key={b.id} title={b.achievement.description} className="glass flex flex-col items-center gap-1.5 rounded-2xl p-3 text-center">
                <span className="flex size-11 items-center justify-center rounded-full bg-lemon">
                  <Icon className="size-5 text-foreground/80" aria-hidden />
                </span>
                <span className="line-clamp-2 text-xs font-semibold">{b.achievement.name}</span>
                <span className="text-[0.7rem] text-muted-foreground">{format(parseISO(b.earned_at), 'd MMM yyyy')}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function MemberSharedHabits({ member, isMe }: { member: FamilyMemberWithProfile; isMe: boolean }) {
  const mine = useHabits()
  const shared = useSharedFamilyHabits()
  const source = isMe ? mine : shared
  const habits = useMemo<HabitWithFields[]>(
    () => (source.data ?? []).filter((h) => h.owner_id === member.user_id && h.visibility === 'family' && !h.archived_at),
    [source.data, member.user_id],
  )
  const habitIds = useMemo(() => habits.map((h) => h.id), [habits])
  const definitions = useFieldDefinitions(habitIds)
  const streaks = useHabitStreaks(habitIds)
  const name = member.profile.display_name

  return (
    <section aria-labelledby="member-habits-title" className="space-y-3">
      <div>
        <h2 id="member-habits-title" className="text-lg font-bold">Shared habits</h2>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Eye className="size-4 shrink-0" aria-hidden />
          {isMe ? 'Your family only sees the habits you share.' : `You only see habits ${name} shares with the family.`}
        </p>
      </div>
      {source.isPending ? (
        <LoadingState rows={2} />
      ) : source.error ? (
        <ErrorState error={source.error} onRetry={() => void source.refetch()} />
      ) : habits.length === 0 ? (
        <GlassCard className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {isMe ? 'You are not sharing any habits yet.' : `${name} isn't sharing any habits yet.`}
          </p>
          {isMe ? (
            <Button asChild variant="secondary" className="h-11">
              <Link to="/habits">Choose habits to share</Link>
            </Button>
          ) : null}
        </GlassCard>
      ) : definitions.error ? (
        <ErrorState error={definitions.error} onRetry={() => void definitions.refetch()} />
      ) : (
        <div className="space-y-3">
          {habits.map((h) => (
            <SharedHabitCard
              key={h.id}
              habit={h}
              streak={streaks.data[h.id]}
              streakPending={streaks.isPending}
              definitions={definitions.data ?? []}
            />
          ))}
        </div>
      )}
    </section>
  )
}
