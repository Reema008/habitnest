import { Link, useNavigate, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Home, KeyRound, SearchX, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/common/glass-card'
import { useOnline } from '@/components/common/offline-banner'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { isInviteCode, normalizeInviteCode } from '@/components/family/invite-code'
import { previewInvitation } from '@/api/family'
import { useJoinFamily, useMyFamily } from '@/hooks/use-family'
import { toUserMessage } from '@/lib/errors'
import { queryKeys } from '@/lib/query-keys'

const INVALID_MESSAGE = 'This invite code is invalid or has expired'

/** /family/join/:code — preview an invite and join the family. */
export default function JoinFamilyPage() {
  const params = useParams()
  const code = normalizeInviteCode(params.code ?? '')
  const validFormat = isInviteCode(code)
  const navigate = useNavigate()
  const online = useOnline()
  const family = useMyFamily()
  const join = useJoinFamily()
  const notInFamily = family.isSuccess && !family.data

  const preview = useQuery({
    queryKey: [...queryKeys.family.all, 'invite-preview', code],
    queryFn: () => previewInvitation(code),
    enabled: validFormat && notInFamily,
    staleTime: 0,
    gcTime: 0,
  })

  async function onJoin() {
    try {
      const joined = await join.mutateAsync(code)
      if (!joined) {
        toast.error(`${INVALID_MESSAGE}.`)
        return
      }
      toast.success(`Welcome to ${preview.data?.familyName ?? 'your family'}!`)
      navigate('/family', { replace: true })
    } catch (e) {
      toast.error(toUserMessage(e))
    }
  }

  const header = <PageHeader title="Join a family" back="/family" />

  if (family.isPending) {
    return (
      <div>
        {header}
        <LoadingState rows={2} />
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
  if (family.data) {
    return (
      <div>
        {header}
        <EmptyState
          icon={Home}
          title={`You're already in ${family.data.family.name}`}
          description="You can be in one family at a time. To join a different one, leave your current family first."
          action={
            <Button asChild className="h-11">
              <Link to="/family">Go to my family</Link>
            </Button>
          }
        />
      </div>
    )
  }

  const invalid = !validFormat || (preview.isSuccess && !preview.data)

  return (
    <div className="space-y-4">
      {header}
      {invalid ? (
        <EmptyState
          icon={SearchX}
          title={INVALID_MESSAGE}
          description="Ask a family admin for a new invite link or code."
          action={
            <Button asChild variant="secondary" className="h-11">
              <Link to="/family">Enter a code or create a family</Link>
            </Button>
          }
        />
      ) : preview.isPending ? (
        <LoadingState rows={1} />
      ) : preview.error ? (
        <ErrorState error={preview.error} onRetry={() => void preview.refetch()} />
      ) : preview.data ? (
        <GlassCard className="space-y-5 p-6 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-peach">
            <Users className="size-8 text-foreground/80" aria-hidden />
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">You've been invited to join</p>
            <h2 className="text-2xl font-extrabold break-words">{preview.data.familyName}</h2>
            <p className="text-sm text-muted-foreground">
              {preview.data.memberCount} {preview.data.memberCount === 1 ? 'member' : 'members'}
            </p>
          </div>
          <p className="text-sm">
            Your habits stay private unless you choose to share them. Shared habits let your family cheer you on.
          </p>
          <p className="font-mono text-sm tracking-[0.3em] text-muted-foreground" aria-label={`Invite code ${code.split('').join(' ')}`}>
            {code}
          </p>
          <Button className="h-12 w-full gap-2" onClick={() => void onJoin()} disabled={!online || join.isPending}>
            <KeyRound className="size-5" aria-hidden /> {join.isPending ? 'Joining…' : 'Join family'}
          </Button>
          {!online ? <p className="text-xs text-muted-foreground">Reconnect to join.</p> : null}
        </GlassCard>
      ) : null}
    </div>
  )
}
