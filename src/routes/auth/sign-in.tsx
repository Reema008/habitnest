import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Fingerprint, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { passkeysSupported, signIn, signInWithPasskey } from '@/api/auth'
import { toUserMessage } from '@/lib/errors'
import { safeNext } from '@/routes/guards'
import { AuthCard } from './auth-layout'

const schema = z.object({
  username: z.string().trim().min(1, 'Enter your username'),
  password: z.string().min(1, 'Enter your password'),
})
type Values = z.infer<typeof schema>

export default function SignInPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const next = safeNext(params.get('next'))
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { username: '', password: '' } })

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await signIn(v.username, v.password)
      navigate(next, { replace: true })
    } catch (e) {
      form.setError('root', { message: toUserMessage(e) })
    }
  })

  async function onPasskey() {
    setPasskeyBusy(true)
    try {
      await signInWithPasskey()
      navigate(next, { replace: true })
    } catch (e) {
      toast.error(toUserMessage(e))
    } finally {
      setPasskeyBusy(false)
    }
  }

  const { errors, isSubmitting } = form.formState
  return (
    <AuthCard title="Welcome back" subtitle="Sign in to your nest.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            autoComplete="username webauthn"
            autoCapitalize="none"
            spellCheck={false}
            className="h-12"
            aria-invalid={!!errors.username}
            {...form.register('username')}
          />
          {errors.username ? <p className="text-sm text-destructive">{errors.username.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            className="h-12"
            aria-invalid={!!errors.password}
            {...form.register('password')}
          />
          {errors.password ? <p className="text-sm text-destructive">{errors.password.message}</p> : null}
        </div>
        {errors.root ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.root.message}
          </p>
        ) : null}
        <Button type="submit" className="h-12 w-full text-base" disabled={isSubmitting}>
          <LogIn className="size-5" /> {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      {passkeysSupported() ? (
        <Button variant="secondary" className="h-12 w-full text-base" onClick={onPasskey} disabled={passkeyBusy}>
          <Fingerprint className="size-5" /> {passkeyBusy ? 'Waiting for your device…' : 'Sign in with fingerprint'}
        </Button>
      ) : null}

      <div className="space-y-2 text-center text-sm text-muted-foreground">
        <p>
          New here?{' '}
          <Link to={`/sign-up${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-primary underline-offset-4 hover:underline">
            Create an account
          </Link>
        </p>
        <p>
          Forgot your password? Use fingerprint sign-in if you set it up, or ask your family admin to reset it for you.
        </p>
      </div>
    </AuthCard>
  )
}
