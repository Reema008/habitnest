import { useState } from 'react'
import { Link } from 'react-router'
import { ChevronRight, Hand, Heart, MoveVertical, Smile, Star, WifiOff } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/common/glass-card'
import { useOnline } from '@/components/common/offline-banner'
import { PageHeader } from '@/components/common/page-header'
import { Pet } from '@/components/pet/pet'
import { GESTURE_LABELS, PET_GESTURES, randomGesture, type PetGesture } from '@/components/pet/pet-config'
import { PetPicker } from '@/components/pet/pet-picker'
import { backTarget } from '@/components/profile/back-target'
import { useUpdateProfile } from '@/hooks/use-profile'
import { toUserMessage } from '@/lib/errors'
import { useCurrentUser } from '@/providers/auth-provider'
import { PET_NAMES, type PetType } from '@/types/models'

const GESTURE_ICONS: Record<PetGesture, LucideIcon> = { wave: Hand, bounce: MoveVertical, nod: Smile }

export default function PetPage() {
  const { profile } = useCurrentUser()
  const online = useOnline()
  const update = useUpdateProfile()
  const [play, setPlay] = useState<{ gesture: PetGesture; key: number }>({ gesture: 'wave', key: 0 })

  const pending = update.isPending ? (update.variables?.pet_type ?? null) : null
  const pet = pending ?? profile.pet_type

  function perform(gesture: PetGesture) {
    setPlay((p) => ({ gesture, key: p.key + 1 }))
  }

  function choose(next: PetType) {
    if (next === profile.pet_type || update.isPending) return
    update.mutate(
      { pet_type: next },
      {
        onSuccess: () => {
          toast.success(`Say hello to your ${PET_NAMES[next]}!`)
          perform('wave')
        },
        onError: (e) => toast.error(toUserMessage(e)),
      },
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader title={pet ? PET_NAMES[pet] : 'Your pet'} subtitle="Always happy to see you" back={backTarget('/home')} />

      {pet ? (
        <>
          <GlassCard as="section" aria-label="Your pet" className="flex flex-col items-center gap-4 pb-5 pt-6">
            <button
              type="button"
              aria-label={`Say hi to your ${PET_NAMES[pet]}`}
              onClick={() => perform(randomGesture())}
              className="rounded-[2.5rem] p-2 outline-none transition-colors hover:bg-lavender/25 focus-visible:ring-3 focus-visible:ring-ring/60"
            >
              <Pet type={pet} size={220} label="" gesture={play.gesture} gestureKey={play.key} />
            </button>
            <p className="text-sm text-muted-foreground">Tap your pet or pick a move</p>
            <div className="grid w-full grid-cols-3 gap-2" role="group" aria-label="Make your pet move">
              {PET_GESTURES.map((g) => {
                const Icon = GESTURE_ICONS[g]
                return (
                  <Button key={g} variant="secondary" className="h-12 rounded-2xl text-sm font-semibold" onClick={() => perform(g)}>
                    <Icon className="size-5" aria-hidden /> {GESTURE_LABELS[g]}
                  </Button>
                )
              })}
            </div>
          </GlassCard>

          <Link
            to="/pet/game"
            className="glass flex min-h-16 items-center gap-3 rounded-2xl p-4 outline-none transition-colors hover:bg-lavender/30 focus-visible:ring-3 focus-visible:ring-ring/60"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-lemon">
              <Star className="size-6 fill-amber-300 text-amber-700" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">Play Star Catch</span>
              <span className="block text-sm text-muted-foreground">Catch falling stars together in 30 seconds</span>
            </span>
            <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
          </Link>
        </>
      ) : (
        <GlassCard className="flex items-start gap-3">
          <Heart className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <p className="text-sm">
            Pick a little companion below. Your pet just says hello and keeps you company — no feeding or care needed, ever.
          </p>
        </GlassCard>
      )}

      <section aria-labelledby="choose-pet" className="space-y-3">
        <div>
          <h2 id="choose-pet" className="text-lg font-extrabold">
            {pet ? 'Change companion' : 'Choose your companion'}
          </h2>
          {!online ? (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <WifiOff className="size-4" aria-hidden /> You can change your pet once you're back online.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">You can switch any time — your new friend will be just as happy.</p>
          )}
        </div>
        <fieldset disabled={!online || update.isPending} aria-busy={update.isPending} className="min-w-0">
          <legend className="sr-only">Pets</legend>
          <PetPicker value={pet} onChange={choose} />
        </fieldset>
      </section>
    </div>
  )
}
