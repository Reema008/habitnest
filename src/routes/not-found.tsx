import { Link } from 'react-router'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/common/states'

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg px-4 pt-20">
      <EmptyState
        icon={Compass}
        title="This page flew the nest"
        description="We couldn't find what you were looking for."
        action={
          <Button asChild>
            <Link to="/home">Go home</Link>
          </Button>
        }
      />
    </div>
  )
}
