import { Link, useNavigate, useParams } from 'react-router'
import { Lock, SearchX } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { ChallengeForm } from '@/components/family/challenge-form'
import { useChallenge, useUpdateChallenge } from '@/hooks/use-challenges'
import { useMyFamily } from '@/hooks/use-family'
import { toUserMessage } from '@/lib/errors'
import { useCurrentUser } from '@/providers/auth-provider'
import type { ChallengeDraft } from '@/domain/challenge'

/** /family/challenges/:id/edit — creator or family admin edits title, description, target and dates. */
export default function EditChallengePage() {
  const { id } = useParams()
  const { userId } = useCurrentUser()
  const navigate = useNavigate()
  const family = useMyFamily()
  const challenge = useChallenge(id)
  const update = useUpdateChallenge()
  const back = `/family/challenges/${id ?? ''}`
  const header = <PageHeader title="Edit challenge" back={back} />

  if (family.isPending || challenge.isPending) {
    return (
      <div>
        {header}
        <LoadingState rows={3} />
      </div>
    )
  }
  if (family.error || challenge.error) {
    return (
      <div>
        {header}
        <ErrorState
          error={family.error ?? challenge.error}
          onRetry={() => {
            void family.refetch()
            void challenge.refetch()
          }}
        />
      </div>
    )
  }
  const c = challenge.data
  if (!c) {
    return (
      <div>
        {header}
        <EmptyState
          icon={SearchX}
          title="Challenge not found"
          description="It may have been deleted."
          action={
            <Button asChild className="h-11">
              <Link to="/family/challenges">All challenges</Link>
            </Button>
          }
        />
      </div>
    )
  }
  const canManage = c.created_by === userId || family.data?.myRole === 'admin'
  if (!canManage) {
    return (
      <div>
        {header}
        <EmptyState
          icon={Lock}
          title="Only the creator or an admin can edit this"
          action={
            <Button asChild variant="secondary" className="h-11">
              <Link to={back}>Back to challenge</Link>
            </Button>
          }
        />
      </div>
    )
  }

  async function onSubmit(d: ChallengeDraft) {
    if (!c) return
    try {
      await update.mutateAsync({
        id: c.id,
        patch: { title: d.title, description: d.description, target: d.target, start_date: d.startDate, end_date: d.endDate },
      })
      toast.success('Challenge updated')
      navigate(back, { replace: true })
    } catch (e) {
      toast.error(toUserMessage(e))
    }
  }

  return (
    <div>
      {header}
      <ChallengeForm initial={c} submitLabel="Save changes" submitting={update.isPending} onSubmit={onSubmit} onCancel={() => navigate(back)} />
    </div>
  )
}
