import { Link } from 'react-router'
import { SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/common/states'
import { PageHeader } from '@/components/common/page-header'

/** Shown when a habit does not exist or belongs to someone else. */
export function HabitNotFound() {
  return (
    <>
      <PageHeader title="Habit not found" back="/habits" />
      <EmptyState
        icon={SearchX}
        title="We couldn't find that habit"
        description="It may have been deleted, or it isn't one of your habits."
        action={
          <Button asChild className="h-11">
            <Link to="/habits">Back to my habits</Link>
          </Button>
        }
      />
    </>
  )
}
