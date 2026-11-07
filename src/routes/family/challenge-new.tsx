import { Link, useNavigate } from 'react-router'
import { Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { ChallengeForm } from '@/components/family/challenge-form'
import { useCreateChallenge } from '@/hooks/use-challenges'
import { useMyFamily } from '@/hooks/use-family'
import { toUserMessage } from '@/lib/errors'
import type { ChallengeDraft } from '@/domain/challenge'

/** /family/challenges/new */
export default function NewChallengePage() {
  const navigate = useNavigate()
  const family = useMyFamily()
  const create = useCreateChallenge()
  const header = <PageHeader title="New challenge" back="/family/challenges" />

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
          icon={Users}
          title="Join a family first"
          description="Challenges are shared with your family, so you'll need one to create a challenge."
          action={
            <Button asChild className="h-11">
              <Link to="/family">Set up a family</Link>
            </Button>
          }
        />
      </div>
    )
  }

  const familyId = family.data.family.id

  async function onSubmit(d: ChallengeDraft) {
    try {
      const created = await create.mutateAsync({
        family_id: familyId,
        title: d.title,
        description: d.description,
        metric_label: d.metricLabel,
        unit: d.aggregation === 'sum' ? d.unit : null,
        aggregation: d.aggregation,
        target: d.target,
        start_date: d.startDate,
        end_date: d.endDate,
      })
      toast.success('Challenge created — your family has been told!')
      navigate(`/family/challenges/${created.id}`, { replace: true })
    } catch (e) {
      toast.error(toUserMessage(e))
    }
  }

  return (
    <div>
      {header}
      <ChallengeForm
        submitLabel="Create challenge"
        submitting={create.isPending}
        onSubmit={onSubmit}
        onCancel={() => navigate('/family/challenges')}
      />
    </div>
  )
}
