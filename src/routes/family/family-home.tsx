import { Link } from 'react-router'
import { ChartColumn, ChevronRight, LogOut, Medal, Trophy, UserPlus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { GlassCard } from '@/components/common/glass-card'
import { useOnline } from '@/components/common/offline-banner'
import { PageHeader } from '@/components/common/page-header'
import { ErrorState, LoadingState } from '@/components/common/states'
import { ActiveChallengesCard } from '@/components/family/active-challenges-card'
import { FamilySetup } from '@/components/family/family-setup'
import { MemberList } from '@/components/family/member-list'
import { RenameFamilyDialog } from '@/components/family/rename-family-dialog'
import { SharedHabitsSection } from '@/components/family/shared-habits-section'
import { useLeaveFamily, useMyFamily } from '@/hooks/use-family'
import { toUserMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { useCurrentUser } from '@/providers/auth-provider'

type QuickLink = { to: string; label: string; hint: string; icon: LucideIcon; bg: string }

/** /family — overview of my family, or create/join when I'm not in one yet. */
export default function FamilyHomePage() {
  const { userId } = useCurrentUser()
  const online = useOnline()
  const family = useMyFamily()
  const leave = useLeaveFamily()

  if (family.isPending) {
    return (
      <div>
        <PageHeader title="Family" />
        <LoadingState rows={4} />
      </div>
    )
  }
  if (family.error) {
    return (
      <div>
        <PageHeader title="Family" />
        <ErrorState error={family.error} onRetry={() => void family.refetch()} />
      </div>
    )
  }
  if (!family.data) {
    return (
      <div>
        <PageHeader title="Family" subtitle="Habits are better together" />
        <FamilySetup />
      </div>
    )
  }

  const { family: fam, members, myRole } = family.data
  const isAdmin = myRole === 'admin'
  const otherAdmins = members.filter((m) => m.role === 'admin' && m.user_id !== userId).length
  const alone = members.length === 1

  const links: QuickLink[] = [
    { to: '/family/challenges', label: 'Challenges', hint: 'Take one on together', icon: Trophy, bg: 'bg-peach' },
    { to: '/family/compare', label: 'Compare', hint: 'Shared progress side by side', icon: ChartColumn, bg: 'bg-sky' },
    { to: '/family/leaderboard', label: 'Leaderboard', hint: 'Celebrate consistency', icon: Medal, bg: 'bg-lemon' },
    ...(isAdmin ? [{ to: '/family/invite', label: 'Invite', hint: 'Add family members', icon: UserPlus, bg: 'bg-mint' }] : []),
  ]

  async function onLeave() {
    try {
      await leave.mutateAsync()
      toast.success(alone ? 'Your family was closed.' : 'You left the family.')
    } catch (e) {
      toast.error(toUserMessage(e))
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={fam.name}
        subtitle={`${members.length} ${members.length === 1 ? 'member' : 'members'} · You're ${isAdmin ? 'an admin' : 'a member'}`}
        action={isAdmin ? <RenameFamilyDialog familyId={fam.id} currentName={fam.name} /> : undefined}
      />

      <nav aria-label="Family sections">
        <ul className="grid grid-cols-2 gap-3">
          {links.map(({ to, label, hint, icon: Icon, bg }) => (
            <li key={to}>
              <Link
                to={to}
                className="glass flex min-h-24 flex-col justify-between gap-2 rounded-2xl p-3 transition hover:bg-lavender/30 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className={cn('flex size-10 items-center justify-center rounded-xl', bg)}>
                  <Icon className="size-5 text-foreground/80" aria-hidden />
                </span>
                <span>
                  <span className="flex items-center justify-between font-bold">
                    {label} <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </span>
                  <span className="block text-xs text-muted-foreground">{hint}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {alone && isAdmin ? (
        <GlassCard className="flex items-center gap-3 bg-mint/30">
          <UserPlus className="size-6 shrink-0 text-primary" aria-hidden />
          <p className="flex-1 text-sm">It's just you for now. Invite your family to start cheering each other on.</p>
          <Button asChild className="h-11">
            <Link to="/family/invite">Invite</Link>
          </Button>
        </GlassCard>
      ) : null}

      <ActiveChallengesCard />

      <MemberList members={members} myUserId={userId} />

      <SharedHabitsSection members={members} myUserId={userId} />

      <GlassCard as="section" aria-labelledby="leave-family-title" className="space-y-2">
        <h2 id="leave-family-title" className="font-bold">Leave family</h2>
        <p className="text-sm text-muted-foreground">
          {alone
            ? 'You are the only member, so leaving will close this family.'
            : isAdmin && otherAdmins === 0
              ? 'You are the only admin. Make another member an admin before you leave.'
              : 'You can leave at any time. Your habits stay with you.'}
        </p>
        <ConfirmDialog
          title={alone ? 'Leave and close this family?' : `Leave ${fam.name}?`}
          description={
            alone
              ? 'You are the only member, so the family and its challenges will be deleted. Your habits stay with you.'
              : 'You will stop seeing shared habits and challenges from this family, and you will leave any challenges you joined. Your own habits stay with you.'
          }
          confirmLabel="Leave family"
          onConfirm={onLeave}
          trigger={
            <Button variant="destructive" className="h-11 w-full gap-2" disabled={!online || leave.isPending}>
              <LogOut className="size-4" aria-hidden /> {leave.isPending ? 'Leaving…' : 'Leave family'}
            </Button>
          }
        />
      </GlassCard>
    </div>
  )
}
