import { useState } from 'react'
import { Link } from 'react-router'
import { ChevronRight, PawPrint } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/common/glass-card'
import { useCurrentUser } from '@/providers/auth-provider'
import { PET_NAMES } from '@/types/models'
import { petGreeting } from './greetings'
import { randomGesture, type PetGesture } from './pet-config'
import { Pet } from './pet'

/** Dashboard card: the user's pet says a warm hello. Tap the pet for a little gesture. */
export function PetGreeting() {
  const { profile } = useCurrentUser()
  const [greeting, setGreeting] = useState(() => petGreeting(profile.display_name))
  const [play, setPlay] = useState<{ gesture: PetGesture; key: number }>(() => ({ gesture: randomGesture(), key: 0 }))

  if (!profile.pet_type) {
    return (
      <GlassCard className="flex items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-lavender/60">
          <PawPrint className="size-8 text-primary" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-bold leading-tight">A little friend is waiting to meet you</p>
          <Button asChild className="h-11">
            <Link to="/pet">Choose a pet</Link>
          </Button>
        </div>
      </GlassCard>
    )
  }

  const petName = PET_NAMES[profile.pet_type]
  return (
    <GlassCard className="flex items-center gap-3">
      <button
        type="button"
        aria-label={`Say hi to your ${petName}`}
        onClick={() => {
          setPlay((p) => ({ gesture: randomGesture(), key: p.key + 1 }))
          setGreeting(petGreeting(profile.display_name))
        }}
        className="shrink-0 rounded-3xl p-1 outline-none transition-colors hover:bg-lavender/30 focus-visible:ring-3 focus-visible:ring-ring/60"
      >
        <Pet type={profile.pet_type} size={96} label="" gesture={play.gesture} gestureKey={play.key} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="relative rounded-2xl bg-background/70 px-3 py-2 text-sm font-semibold shadow-sm">
          <span
            aria-hidden
            className="absolute -left-1.5 top-5 size-3 rotate-45 rounded-[2px] bg-background/70"
          />
          <p aria-live="polite" className="relative">
            {greeting}
          </p>
        </div>
        <Link
          to="/pet"
          className="mt-1 inline-flex min-h-11 items-center gap-0.5 rounded-lg text-sm font-semibold text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
        >
          Visit your {petName} <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
    </GlassCard>
  )
}
