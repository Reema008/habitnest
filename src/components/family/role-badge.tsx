import { Crown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { FamilyRole } from '@/types/models'

/** "Admin" / "Member" pill. */
export function RoleBadge({ role, className }: { role: FamilyRole; className?: string }) {
  return role === 'admin' ? (
    <Badge className={cn('bg-lemon text-foreground', className)}>
      <Crown aria-hidden /> Admin
    </Badge>
  ) : (
    <Badge variant="secondary" className={cn('bg-sky/60 text-foreground', className)}>
      Member
    </Badge>
  )
}
