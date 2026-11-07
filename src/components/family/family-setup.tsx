import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { HeartHandshake, Home, KeyRound, ShieldCheck, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GlassCard } from '@/components/common/glass-card'
import { useOnline } from '@/components/common/offline-banner'
import { useCreateFamily, useJoinFamily } from '@/hooks/use-family'
import { toUserMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { useCurrentUser } from '@/providers/auth-provider'
import { INVITE_CODE_LENGTH, isInviteCode, normalizeInviteCode } from './invite-code'

const createSchema = z.object({
  name: z.string().trim().min(1, 'Give your family a name.').max(50, 'Keep the name under 50 characters.'),
})

const joinSchema = z.object({
  code: z
    .string()
    .transform(normalizeInviteCode)
    .refine(isInviteCode, `Invite codes are ${INVITE_CODE_LENGTH} letters and numbers.`),
})

type Mode = 'create' | 'join'

/** Shown on /family when I am not in a family yet: create one or join with a code. */
export function FamilySetup() {
  const [mode, setMode] = useState<Mode>('create')

  return (
    <div className="space-y-4">
      <GlassCard className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-peach">
            <HeartHandshake className="size-6 text-foreground/80" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-bold">Build habits together</h2>
            <p className="text-sm text-muted-foreground">Cheer each other on, compare progress and take on friendly challenges.</p>
          </div>
        </div>
        <ul className="space-y-2 text-sm">
          <li className="flex gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            <span>Your habits stay private unless you choose to share them with your family.</span>
          </li>
          <li className="flex gap-2">
            <Users className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span>Create a family and invite others, or join one with an invite code from a family admin.</span>
          </li>
        </ul>
      </GlassCard>

      <div className="grid grid-cols-2 gap-3" role="group" aria-label="Choose how to start">
        <ModeButton active={mode === 'create'} onClick={() => setMode('create')} icon={<Home className="size-6" aria-hidden />} label="Create a family" />
        <ModeButton active={mode === 'join'} onClick={() => setMode('join')} icon={<KeyRound className="size-6" aria-hidden />} label="Join with a code" />
      </div>

      {mode === 'create' ? <CreateFamilyForm /> : <JoinFamilyForm />}
    </div>
  )
}

function ModeButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-sm font-semibold transition',
        'focus-visible:outline-2 focus-visible:outline-ring',
        active ? 'border-primary bg-lavender/50' : 'border-border bg-glass hover:bg-lavender/30',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function CreateFamilyForm() {
  const { profile } = useCurrentUser()
  const online = useOnline()
  const createFamily = useCreateFamily()
  const form = useForm({
    resolver: zodResolver(createSchema),
    defaultValues: { name: `${profile.display_name}'s Nest`.slice(0, 50) },
  })
  const error = form.formState.errors.name?.message

  const onSubmit = form.handleSubmit(async ({ name }) => {
    try {
      await createFamily.mutateAsync(name)
      toast.success(`Welcome to ${name}! Invite your family next.`)
    } catch (e) {
      toast.error(toUserMessage(e))
    }
  })

  return (
    <GlassCard as="section" aria-labelledby="create-family-title">
      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)} noValidate>
        <div>
          <h2 id="create-family-title" className="text-lg font-bold">Create a family</h2>
          <p className="text-sm text-muted-foreground">You'll be the family admin and can invite others.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="family-name">Family name</Label>
          <Input
            id="family-name"
            className="h-12"
            maxLength={50}
            autoComplete="off"
            aria-invalid={!!error}
            aria-describedby={error ? 'family-name-error' : undefined}
            {...form.register('name')}
          />
          {error ? (
            <p id="family-name-error" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <Button type="submit" className="h-12 w-full" disabled={!online || createFamily.isPending}>
          <Home className="size-5" aria-hidden /> {createFamily.isPending ? 'Creating…' : 'Create family'}
        </Button>
        {!online ? <p className="text-center text-xs text-muted-foreground">Reconnect to create a family.</p> : null}
      </form>
    </GlassCard>
  )
}

function JoinFamilyForm() {
  const online = useOnline()
  const navigate = useNavigate()
  const joinFamily = useJoinFamily()
  const form = useForm({ resolver: zodResolver(joinSchema), defaultValues: { code: '' } })
  const error = form.formState.errors.code?.message

  const onSubmit = form.handleSubmit(async ({ code }) => {
    try {
      const joined = await joinFamily.mutateAsync(code)
      if (!joined) {
        form.setError('code', { message: 'This invite code is invalid or has expired.' })
        return
      }
      toast.success('You joined the family. Welcome!')
      navigate('/family', { replace: true })
    } catch (e) {
      toast.error(toUserMessage(e))
    }
  })

  const codeField = form.register('code')

  return (
    <GlassCard as="section" aria-labelledby="join-family-title">
      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)} noValidate>
        <div>
          <h2 id="join-family-title" className="text-lg font-bold">Join a family</h2>
          <p className="text-sm text-muted-foreground">
            Ask a family admin for an invite code or link. Codes are {INVITE_CODE_LENGTH} letters and numbers.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-code">Invite code</Label>
          <Input
            id="invite-code"
            className="h-12 font-mono text-lg tracking-[0.3em] uppercase"
            maxLength={INVITE_CODE_LENGTH}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="ABCD2345EF"
            aria-invalid={!!error}
            aria-describedby={error ? 'invite-code-error' : undefined}
            {...codeField}
            onChange={(e) => {
              e.target.value = normalizeInviteCode(e.target.value)
              void codeField.onChange(e)
            }}
          />
          {error ? (
            <p id="invite-code-error" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <Button type="submit" className="h-12 w-full" disabled={!online || joinFamily.isPending}>
          <KeyRound className="size-5" aria-hidden /> {joinFamily.isPending ? 'Joining…' : 'Join family'}
        </Button>
        {!online ? <p className="text-center text-xs text-muted-foreground">Reconnect to join a family.</p> : null}
      </form>
    </GlassCard>
  )
}
