import { Lock, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HabitVisibility } from '@/types/models'

/** Shows whether a habit is private or shared with the family. Every habit view should include it. */
export function PrivacyBadge({ visibility, className }: { visibility: HabitVisibility; className?: string }) {
  const shared = visibility === 'family'
  const Icon = shared ? Users : Lock
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold',
        shared ? 'bg-mint/60 text-foreground' : 'bg-muted text-muted-foreground',
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {shared ? 'Shared with family' : 'Private'}
    </span>
  )
}
