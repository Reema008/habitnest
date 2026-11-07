import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { GlassCard } from '@/components/common/glass-card'
import { UserAvatar } from '@/components/common/user-avatar'
import type { FamilyMemberWithProfile } from '@/types/models'
import { RoleBadge } from './role-badge'

/** Family members; each row opens the member page. */
export function MemberList({ members, myUserId }: { members: FamilyMemberWithProfile[]; myUserId: string }) {
  return (
    <GlassCard as="section" aria-labelledby="members-title" className="p-2">
      <h2 id="members-title" className="px-2 pt-2 pb-1 text-base font-bold">
        Members <span className="font-semibold text-muted-foreground">({members.length})</span>
      </h2>
      <ul className="divide-y divide-border/60">
        {members.map((m) => (
          <li key={m.user_id}>
            <Link
              to={`/family/members/${m.user_id}`}
              className="flex min-h-14 items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-lavender/30 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <UserAvatar profile={m.profile} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {m.profile.display_name}
                  {m.user_id === myUserId ? <span className="font-normal text-muted-foreground"> (you)</span> : null}
                </span>
              </span>
              <RoleBadge role={m.role} />
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </GlassCard>
  )
}
