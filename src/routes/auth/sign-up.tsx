import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Check, UserPlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PASSWORD_MIN_LENGTH, USERNAME_PATTERN, isUsernameAvailable, normalizeUsername, signUp } from '@/api/auth'
import { toUserMessage } from '@/lib/errors'
import { safeNext } from '@/routes/guards'
import { AuthCard } from './auth-layout'

const schema = z
  .object({
    displayName: z.string().trim().min(1, 'Enter your name').max(40, 'Keep it under 40 characters'),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(USERNAME_PATTERN, '3–20 lowercase letters, numbers or underscores'),
    password: z.string().min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`).max(72),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })
type Values = z.infer<typeof schema>

export default function SignUpPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const next = safeNext(params.get('next'))
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: '', username: '', password: '', confirm: '' },
    mode: 'onBlur',
  })
  const username = normalizeUsername(form.watch('username') ?? '')
  const [availability, setAvailability] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')

  useEffect(() => {
    if (!USERNAME_PATTERN.test(username)) {
      setAvailability('idle')
      return
    }
    setAvailability('checking')
    const t = setTimeout(async () => {
      try {
        setAvailability((await isUsernameAvailable(username)) ? 'available' : 'taken')
      } catch {
        setAvailability('idle')
      }
    }, 400)
    return () => clearTimeout(t)
  }, [username])

  const onSubmit = form.handleSubmit(async (v) => {
    if (availability === 'taken') {
      form.setError('username', { message: 'That username is already taken' })
      return
    }
    try {
      await signUp({ username: v.username, password: v.password, displayName: v.displayName })
      navigate(`/onboarding?next=${encodeURIComponent(next)}`, { replace: true })
    } catch (e) {
      form.setError('root', { message: toUserMessage(e) })
    }
  })

  const { errors, isSubmitting } = form.formState
  return (
    <AuthCard title="Create your account" subtitle="No email needed — just a username and password.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="displayName">Your name</Label>
          <Input id="displayName" autoComplete="nickname" className="h-12" aria-invalid={!!errors.displayName} {...form.register('displayName')} />
          {errors.displayName ? <p className="text-sm text-destructive">{errors.displayName.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <div className="relative">
            <Input
              id="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              className="h-12 pr-10"
              aria-invalid={!!errors.username || availability === 'taken'}
              aria-describedby="username-hint"
              {...form.register('username')}
            />
            <span className="absolute inset-y-0 right-3 flex items-center" aria-hidden>
              {availability === 'available' ? <Check className="size-5 text-success" /> : null}
              {availability === 'taken' ? <X className="size-5 text-destructive" /> : null}
            </span>
          </div>
          <p id="username-hint" className="text-sm text-muted-foreground" aria-live="polite">
            {errors.username?.message ??
              (availability === 'taken'
                ? 'That username is already taken.'
                : availability === 'available'
                  ? 'Nice — that username is free.'
                  : 'Lowercase letters, numbers and _ (you will sign in with this).')}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" className="h-12" aria-invalid={!!errors.password} {...form.register('password')} />
          {errors.password ? <p className="text-sm text-destructive">{errors.password.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" type="password" autoComplete="new-password" className="h-12" aria-invalid={!!errors.confirm} {...form.register('confirm')} />
          {errors.confirm ? <p className="text-sm text-destructive">{errors.confirm.message}</p> : null}
        </div>
        {errors.root ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.root.message}
          </p>
        ) : null}
        <Button type="submit" className="h-12 w-full text-base" disabled={isSubmitting}>
          <UserPlus className="size-5" /> {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to={`/sign-in${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  )
}
