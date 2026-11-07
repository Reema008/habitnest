import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/page-header'
import { ErrorState, LoadingState } from '@/components/common/states'
import { HabitBuilder, type HabitBuilderResult } from '@/components/habits/habit-builder'
import { builderFromHabit } from '@/components/habits/builder-model'
import { useHabit, useSaveHabitFields, useUpdateHabit } from '@/hooks/use-habits'
import { toUserMessage } from '@/lib/errors'
import { useCurrentUser } from '@/providers/auth-provider'
import type { HabitWithFields } from '@/types/models'
import { HabitNotFound } from './habit-not-found'

export default function EditHabitPage() {
  const { id } = useParams()
  const { userId } = useCurrentUser()
  const habitQuery = useHabit(id)

  if (habitQuery.isPending) {
    return (
      <>
        <PageHeader title="Edit habit" back={id ? `/habits/${id}` : '/habits'} />
        <LoadingState rows={4} />
      </>
    )
  }
  if (habitQuery.isError) {
    return (
      <>
        <PageHeader title="Edit habit" back="/habits" />
        <ErrorState error={habitQuery.error} onRetry={() => void habitQuery.refetch()} />
      </>
    )
  }
  const habit = habitQuery.data
  if (!habit || habit.owner_id !== userId) return <HabitNotFound />
  return <EditHabitForm habit={habit} />
}

function EditHabitForm({ habit }: { habit: HabitWithFields }) {
  const navigate = useNavigate()
  const updateHabit = useUpdateHabit()
  const saveFields = useSaveHabitFields()
  // Snapshot once so background refetches never overwrite in-progress edits.
  const [initial] = useState(() => builderFromHabit(habit))

  async function save({ meta, fields, goal }: HabitBuilderResult) {
    try {
      await updateHabit.mutateAsync({ id: habit.id, patch: meta })
      await saveFields.mutateAsync({ habitId: habit.id, fields, goal })
      toast.success('Habit updated')
      navigate(`/habits/${habit.id}`, { replace: true })
    } catch (e) {
      toast.error(toUserMessage(e))
    }
  }

  return (
    <>
      <PageHeader title="Edit habit" subtitle={habit.name} back={`/habits/${habit.id}`} />
      <HabitBuilder mode="edit" initial={initial} templateKey={habit.template_key} onSave={save} />
    </>
  )
}
