import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/page-header'
import { HabitBuilder, type HabitBuilderResult } from '@/components/habits/habit-builder'
import { emptyBuilder } from '@/components/habits/builder-model'
import { useCreateHabit } from '@/hooks/use-habits'
import { toUserMessage } from '@/lib/errors'

export default function NewHabitPage() {
  const navigate = useNavigate()
  const createHabit = useCreateHabit()
  const [initial] = useState(emptyBuilder)

  async function save({ meta, fields, goal }: HabitBuilderResult) {
    try {
      const id = await createHabit.mutateAsync({ meta, fields, goal })
      toast.success(`"${meta.name}" is ready. You've got this!`)
      navigate(`/habits/${id}`, { replace: true })
    } catch (e) {
      toast.error(toUserMessage(e))
    }
  }

  return (
    <>
      <PageHeader title="New habit" subtitle="Build it your way" back="/habits" />
      <HabitBuilder mode="create" initial={initial} onSave={save} />
    </>
  )
}
