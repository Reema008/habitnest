import { useState } from 'react'
import { Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { formatDistanceToNowStrict, isPast, parseISO } from 'date-fns'
import { Ban, Lock, Share2, Sparkles, Ticket } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { GlassCard } from '@/components/common/glass-card'
import { useOnline } from '@/components/common/offline-banner'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { CopyButton } from '@/components/family/copy-button'
import { copyToClipboard } from '@/components/family/family-utils'
import { inviteLink } from '@/api/family'
import { useCreateInvitation, useInvitations, useMyFamily, useRevokeInvitation } from '@/hooks/use-family'
import { toUserMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import type { FamilyInvitation } from '@/types/models'

const schema = z.object({
  maxUses: z.number({ error: 'Enter a number from 1 to 50.' }).int('Use a whole number.').min(1, 'At least 1 use.').max(50, 'At most 50 uses.'),
  validDays: z.number({ error: 'Enter a number from 1 to 30.' }).int('Use a whole number.').min(1, 'At least 1 day.').max(30, 'At most 30 days.'),
})

type InviteStatus = 'active' | 'expired' | 'used' | 'revoked'

function inviteStatus(inv: FamilyInvitation): InviteStatus {
  if (inv.revoked_at) return 'revoked'
  if (inv.use_count >= inv.max_uses) return 'used'
  if (isPast(parseISO(inv.expires_at))) return 'expired'
  return 'active'
}

const STATUS_LABEL: Record<InviteStatus, { text: string; className: string }> = {
  active: { text: 'Active', className: 'bg-mint text-foreground' },
  expired: { text: 'Expired', className: 'bg-muted text-muted-foreground' },
  used: { text: 'All uses taken', className: 'bg-sky text-foreground' },
  revoked: { text: 'Revoked', className: 'bg-muted text-muted-foreground' },
}

async function shareInvite(code: string, familyName: string) {
  const url = inviteLink(code)
  const shareData = {
    title: `Join ${familyName} on HabitNest`,
    text: `Join our family on HabitNest! Use invite code ${code} or open this link:`,
    url,
  }
  if (typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare(shareData))) {
    try {
      await navigator.share(shareData)
      return
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return // user closed the share sheet
    }
  }
  if (await copyToClipboard(url)) toast.success('Invite link copied')
  else toast.error('Could not share automatically — copy the code instead.')
}

/** /family/invite — admins create, share and revoke invitations. */
export default function InvitePage() {
  const family = useMyFamily()
  const isAdmin = family.data?.myRole === 'admin'
  const invitations = useInvitations(isAdmin)
  const header = <PageHeader title="Invite family" back="/family" />

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
  if (!family.data) {
    return (
      <div>
        {header}
        <EmptyState
          icon={Ticket}
          title="Create a family first"
          description="Once you have a family, you can invite others to join it."
          action={
            <Button asChild className="h-11">
              <Link to="/family">Set up a family</Link>
            </Button>
          }
        />
      </div>
    )
  }
  if (!isAdmin) {
    return (
      <div>
        {header}
        <EmptyState
          icon={Lock}
          title="Only admins can invite"
          description="Ask a family admin to send an invite to whoever you'd like to add."
          action={
            <Button asChild variant="secondary" className="h-11">
              <Link to="/family">Back to family</Link>
            </Button>
          }
        />
      </div>
    )
  }

  const familyName = family.data.family.name

  return (
    <div className="space-y-5">
      {header}
      <CreateInviteCard familyName={familyName} />
      <section aria-labelledby="invites-title" className="space-y-3">
        <h2 id="invites-title" className="text-lg font-bold">Invitations</h2>
        {invitations.isPending ? (
          <LoadingState rows={2} />
        ) : invitations.error ? (
          <ErrorState error={invitations.error} onRetry={() => void invitations.refetch()} />
        ) : invitations.data.length === 0 ? (
          <GlassCard>
            <p className="text-sm text-muted-foreground">No invitations yet. Create one above to get started.</p>
          </GlassCard>
        ) : (
          <ul className="space-y-3">
            {invitations.data.map((inv) => (
              <InvitationRow key={inv.id} invitation={inv} familyName={familyName} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function CreateInviteCard({ familyName }: { familyName: string }) {
  const online = useOnline()
  const create = useCreateInvitation()
  const [created, setCreated] = useState<{ code: string; expiresAt: string; maxUses: number } | null>(null)
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { maxUses: 10, validDays: 7 } })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const row = await create.mutateAsync(values)
      if (!row.code || !row.expires_at) throw new Error('The invitation could not be created. Please try again.')
      setCreated({ code: row.code, expiresAt: row.expires_at, maxUses: row.max_uses ?? values.maxUses })
      toast.success('Invitation ready to share')
    } catch (e) {
      toast.error(toUserMessage(e))
    }
  })

  return (
    <GlassCard as="section" aria-labelledby="new-invite-title" className="space-y-4">
      <div>
        <h2 id="new-invite-title" className="text-lg font-bold">New invitation</h2>
        <p className="text-sm text-muted-foreground">Share a code or link. Anyone who has it can join until it expires or runs out of uses.</p>
      </div>

      {created ? (
        <div className="space-y-3 rounded-2xl bg-lavender/40 p-4 text-center">
          <p className="text-sm text-muted-foreground">Invite code</p>
          <p
            className="font-mono text-3xl font-extrabold tracking-[0.25em] select-all break-all"
            aria-label={`Invite code ${created.code.split('').join(' ')}`}
          >
            {created.code}
          </p>
          <p className="text-xs text-muted-foreground">
            Works for {created.maxUses} {created.maxUses === 1 ? 'person' : 'people'} · expires{' '}
            {formatDistanceToNowStrict(parseISO(created.expiresAt), { addSuffix: true })}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <CopyButton text={created.code} label="Copy code" successMessage="Invite code copied" />
            <Button type="button" className="h-11 gap-2" onClick={() => void shareInvite(created.code, familyName)}>
              <Share2 className="size-4" aria-hidden /> Share link
            </Button>
          </div>
          <Button type="button" variant="ghost" className="h-11 w-full" onClick={() => setCreated(null)}>
            Create another
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={(e) => void onSubmit(e)} noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="invite-max-uses">How many people</Label>
              <Input
                id="invite-max-uses"
                type="number"
                inputMode="numeric"
                min={1}
                max={50}
                className="h-12"
                aria-invalid={!!errors.maxUses}
                aria-describedby={errors.maxUses ? 'invite-max-uses-error' : undefined}
                {...form.register('maxUses', { valueAsNumber: true })}
              />
              {errors.maxUses ? (
                <p id="invite-max-uses-error" className="text-sm text-destructive">
                  {errors.maxUses.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-valid-days">Valid for (days)</Label>
              <Input
                id="invite-valid-days"
                type="number"
                inputMode="numeric"
                min={1}
                max={30}
                className="h-12"
                aria-invalid={!!errors.validDays}
                aria-describedby={errors.validDays ? 'invite-valid-days-error' : undefined}
                {...form.register('validDays', { valueAsNumber: true })}
              />
              {errors.validDays ? (
                <p id="invite-valid-days-error" className="text-sm text-destructive">
                  {errors.validDays.message}
                </p>
              ) : null}
            </div>
          </div>
          <Button type="submit" className="h-12 w-full gap-2" disabled={!online || create.isPending}>
            <Sparkles className="size-5" aria-hidden /> {create.isPending ? 'Creating…' : 'Create invite'}
          </Button>
          {!online ? <p className="text-center text-xs text-muted-foreground">Reconnect to create invitations.</p> : null}
        </form>
      )}
    </GlassCard>
  )
}

function InvitationRow({ invitation, familyName }: { invitation: FamilyInvitation; familyName: string }) {
  const online = useOnline()
  const revoke = useRevokeInvitation()
  const status = inviteStatus(invitation)
  const label = STATUS_LABEL[status]
  const expires = parseISO(invitation.expires_at)
  const isActive = status === 'active'

  async function onRevoke() {
    try {
      await revoke.mutateAsync(invitation.id)
      toast.success('Invitation revoked')
    } catch (e) {
      toast.error(toUserMessage(e))
    }
  }

  return (
    <GlassCard as="li" className={cn('space-y-3', !isActive && 'opacity-80')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-lg font-bold tracking-[0.2em]">{invitation.code}</p>
          <p className="text-xs text-muted-foreground">
            {invitation.use_count} of {invitation.max_uses} used ·{' '}
            {isPast(expires) ? 'expired' : 'expires'} {formatDistanceToNowStrict(expires, { addSuffix: true })}
          </p>
        </div>
        <Badge className={label.className}>{label.text}</Badge>
      </div>
      {isActive ? (
        <div className="grid grid-cols-3 gap-2">
          <CopyButton text={invitation.code} label="Copy" successMessage="Invite code copied" className="px-2" />
          <Button type="button" variant="secondary" className="h-11 gap-1.5 px-2" onClick={() => void shareInvite(invitation.code, familyName)}>
            <Share2 className="size-4" aria-hidden /> Share
          </Button>
          <ConfirmDialog
            title="Revoke this invitation?"
            description={`Code ${invitation.code} will stop working. People who already joined stay in the family.`}
            confirmLabel="Revoke"
            onConfirm={onRevoke}
            trigger={
              <Button type="button" variant="destructive" className="h-11 gap-1.5 px-2" disabled={!online || revoke.isPending}>
                <Ban className="size-4" aria-hidden /> Revoke
              </Button>
            }
          />
        </div>
      ) : null}
    </GlassCard>
  )
}
