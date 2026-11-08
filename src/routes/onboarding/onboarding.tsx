import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Home, Sparkles, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GlassCard } from '@/components/common/glass-card'
import { AVATAR_PRESETS, UserAvatar } from '@/components/common/user-avatar'
import { PetPicker } from '@/components/pet/pet-picker'
import { updateMyProfile } from '@/api/profiles'
import { supabase } from '@/lib/supabase'
import { deviceTimeZone } from '@/lib/dates'
import { toUserMessage, unwrap, unwrapMaybe } from '@/lib/errors'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { useCurrentUser } from '@/providers/auth-provider'
import { safeNext } from '@/routes/guards'
import type { PetType } from '@/types/models'

type Step = 'profile' | 'pet' | 'family'

/** First-run setup: name & avatar → pet → family (create / join / skip). */
export default function OnboardingPage() {
  const { userId, profile } = useCurrentUser()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const joiningViaLink = next.startsWith('/family/join/')
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [step, setStep] = useState<Step>('profile')
  const [displayName, setDisplayName] = useState(profile.display_name)
  const [preset, setPreset] = useState<string>(profile.avatar_preset ?? 'fox')
  const [pet, setPet] = useState<PetType | null>(profile.pet_type)
  const [familyMode, setFamilyMode] = useState<'create' | 'join' | null>(null)
  const [familyName, setFamilyName] = useState(`${profile.display_name}'s Nest`)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const steps: Step[] = joiningViaLink ? ['profile', 'pet'] : ['profile', 'pet', 'family']
  const index = steps.indexOf(step)

  async function finish() {
    setBusy(true)
    try {
      if (!joiningViaLink && familyMode === 'create') {
        unwrap(await supabase.rpc('create_family', { p_name: familyName.trim() }))
      } else if (!joiningViaLink && familyMode === 'join') {
        const joined = unwrapMaybe(await supabase.rpc('join_family', { p_code: code.trim().toUpperCase() }))
        if (!joined) {
          toast.error('That invite code is invalid or has expired.')
          return
        }
      }
      const saved = await updateMyProfile(userId, {
        display_name: displayName.trim() || profile.display_name,
        avatar_preset: preset,
        pet_type: pet,
        timezone: deviceTimeZone(),
        onboarded_at: new Date().toISOString(),
      })
      // Update the cache immediately so guards never see the pre-onboarding profile.
      qc.setQueryData([...queryKeys.profile.me, userId], saved)
      await qc.invalidateQueries({ queryKey: queryKeys.profile.me })
      await qc.invalidateQueries({ queryKey: queryKeys.family.all })
      navigate(next, { replace: true })
    } catch (e) {
      toast.error(toUserMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const canContinue =
    step === 'profile'
      ? displayName.trim().length > 0 && displayName.trim().length <= 40
      : step === 'family'
        ? familyMode === null || (familyMode === 'create' ? familyName.trim().length > 0 : code.trim().length >= 10)
        : true

  return (
    <div className="flex min-h-[calc(100dvh-2rem)] flex-col py-6">
      <div className="mb-6 flex items-center justify-center gap-2" aria-label={`Step ${index + 1} of ${steps.length}`}>
        {steps.map((s, i) => (
          <span key={s} className={cn('h-2 rounded-full transition-all', i <= index ? 'w-8 bg-primary' : 'w-2 bg-lavender')} />
        ))}
      </div>

      <GlassCard className="flex-1 space-y-6 p-6">
        {step === 'profile' ? (
          <section className="space-y-5">
            <div>
              <h1 className="text-2xl font-extrabold">Welcome to HabitNest</h1>
              <p className="text-sm text-muted-foreground">Let's set up your profile. You can change this any time.</p>
            </div>
            <div className="flex justify-center">
              <UserAvatar profile={{ display_name: displayName, avatar_url: profile.avatar_url, avatar_preset: preset }} className="size-24 text-4xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input id="displayName" className="h-12" maxLength={40} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Pick an avatar</legend>
              <div className="grid grid-cols-6 gap-2">
                {AVATAR_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-label={p.id}
                    aria-pressed={preset === p.id}
                    onClick={() => setPreset(p.id)}
                    className={cn(
                      'flex aspect-square items-center justify-center rounded-2xl text-2xl transition',
                      p.bg,
                      preset === p.id ? 'ring-3 ring-primary' : 'opacity-80 hover:opacity-100',
                    )}
                  >
                    <span aria-hidden>{p.emoji}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          </section>
        ) : null}

        {step === 'pet' ? (
          <section className="space-y-4">
            <div>
              <h1 className="text-2xl font-extrabold">Choose a little companion</h1>
              <p className="text-sm text-muted-foreground">Your pet just says hello and keeps you company — no care needed.</p>
            </div>
            <PetPicker value={pet} onChange={setPet} />
          </section>
        ) : null}

        {step === 'family' ? (
          <section className="space-y-4">
            <div>
              <h1 className="text-2xl font-extrabold">Your family nest</h1>
              <p className="text-sm text-muted-foreground">Create a family, join one with an invite code, or skip for now.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <OptionButton active={familyMode === 'create'} onClick={() => setFamilyMode('create')} icon={<Home className="size-6" />} label="Create a family" />
              <OptionButton active={familyMode === 'join'} onClick={() => setFamilyMode('join')} icon={<Users className="size-6" />} label="Join with a code" />
            </div>
            {familyMode === 'create' ? (
              <div className="space-y-2">
                <Label htmlFor="familyName">Family name</Label>
                <Input id="familyName" className="h-12" maxLength={50} value={familyName} onChange={(e) => setFamilyName(e.target.value)} />
              </div>
            ) : null}
            {familyMode === 'join' ? (
              <div className="space-y-2">
                <Label htmlFor="code">Invite code</Label>
                <Input
                  id="code"
                  className="h-12 font-mono tracking-widest uppercase"
                  maxLength={10}
                  autoCapitalize="characters"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                />
              </div>
            ) : null}
            {familyMode ? (
              <Button variant="ghost" className="w-full" onClick={() => setFamilyMode(null)}>
                Skip for now
              </Button>
            ) : null}
          </section>
        ) : null}
      </GlassCard>

      <div className="mt-4 flex gap-3">
        {index > 0 ? (
          <Button variant="secondary" className="h-12 flex-1" onClick={() => setStep(steps[index - 1]!)} disabled={busy}>
            <ArrowLeft className="size-5" /> Back
          </Button>
        ) : null}
        {index < steps.length - 1 ? (
          <Button className="h-12 flex-1" onClick={() => setStep(steps[index + 1]!)} disabled={!canContinue}>
            Next <ArrowRight className="size-5" />
          </Button>
        ) : (
          <Button className="h-12 flex-1" onClick={() => void finish()} disabled={!canContinue || busy}>
            <Sparkles className="size-5" /> {busy ? 'Setting up…' : 'Start my nest'}
          </Button>
        )}
      </div>
    </div>
  )
}

function OptionButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-sm font-semibold transition',
        active ? 'border-primary bg-lavender/50' : 'border-border bg-glass hover:bg-lavender/30',
      )}
    >
      {icon}
      {label}
    </button>
  )
}
