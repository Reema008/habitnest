import { Link } from 'react-router'
import { Bell, CalendarClock, ChevronRight, ListChecks, PawPrint, Settings } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { GlassCard } from '@/components/common/glass-card'
import { Pet } from '@/components/pet/pet'
import { PET_NAMES, type PetType } from '@/types/models'

const LINKS: { to: string; label: string; description: string; icon: LucideIcon; bg: string }[] = [
  { to: '/schedule', label: 'My schedule', description: 'Your weekly rhythm', icon: CalendarClock, bg: 'bg-sky' },
  { to: '/habits', label: 'Habits', description: 'Create and manage habits', icon: ListChecks, bg: 'bg-mint' },
  { to: '/pet', label: 'Pet', description: 'Say hi to your companion', icon: PawPrint, bg: 'bg-peach' },
  { to: '/notifications', label: 'Notifications', description: 'Updates and reminders', icon: Bell, bg: 'bg-lemon' },
  { to: '/settings', label: 'Settings', description: 'Theme, reminders, security', icon: Settings, bg: 'bg-lavender' },
]

/** Navigation rows from the profile hub. */
export function ProfileLinks() {
  return (
    <GlassCard as="section" aria-label="Quick links" className="p-2">
      <ul className="divide-y divide-border">
        {LINKS.map(({ to, label, description, icon: Icon, bg }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex min-h-14 items-center gap-3 rounded-xl px-2 py-2 outline-none transition-colors hover:bg-lavender/25 focus-visible:ring-3 focus-visible:ring-ring/60"
            >
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                <Icon className="size-5 text-foreground/80" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{label}</span>
                <span className="block truncate text-xs text-muted-foreground">{description}</span>
              </span>
              <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </GlassCard>
  )
}

/** Small pet preview linking to /pet. */
export function PetPreviewCard({ pet }: { pet: PetType | null }) {
  return (
    <Link
      to="/pet"
      className="glass flex min-h-20 items-center gap-3 rounded-2xl p-3 outline-none transition-colors hover:bg-lavender/25 focus-visible:ring-3 focus-visible:ring-ring/60"
    >
      {pet ? (
        <Pet type={pet} size={72} label="" />
      ) : (
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-peach/70">
          <PawPrint className="size-7 text-foreground/70" aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-muted-foreground">Your companion</span>
        <span className="block font-bold">{pet ? PET_NAMES[pet] : 'Choose a pet'}</span>
        <span className="block text-xs text-muted-foreground">{pet ? 'Tap to say hi or play Star Catch' : 'A little friend to say hello'}</span>
      </span>
      <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
    </Link>
  )
}
