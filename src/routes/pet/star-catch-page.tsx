import { PageHeader } from '@/components/common/page-header'
import { StarCatchGame } from '@/components/pet/star-catch-game'

export default function StarCatchPage() {
  return (
    <div>
      <PageHeader title="Star Catch" subtitle="A 30-second game, just for fun" back="/pet" />
      <StarCatchGame />
    </div>
  )
}
