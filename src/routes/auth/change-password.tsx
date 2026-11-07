import { useNavigate, useSearchParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PASSWORD_MIN_LENGTH, changePassword, signOut } from '@/api/auth'
import { toUserMessage } from '@/lib/errors'
import { useAuth } from '@/providers/auth-provider'
import { safeNext } from '@/routes/guards'
import { AuthCard } from './auth-layout'

const schema = z
  .object({
    password: z.string().min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`).max(72),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })
type Values = z.infer<typeof schema>

/** Shown after a family admin reset this member's password (temporary password in use). */
export default function ChangePasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { refetchProfile } = useAuth()
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '' } })

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await changePassword(v.password)
      refetchProfile()
      toast.success('Password updated')
      navigate(safeNext(params.get('next')), { replace: true })
    } catch (e) {
      form.setError('root', { message: toUserMessage(e) })
    }
  })

  const { errors, isSubmitting } = form.formState
  return (
    <AuthCard title="Choose a new password" subtitle="Your password was reset by a family admin. Please pick a new one only you know.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" autoComplete="new-password" className="h-12" {...form.register('password')} />
          {errors.password ? <p className="text-sm text-destructive">{errors.password.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm new password</Label>
          <Input id="confirm" type="password" autoComplete="new-password" className="h-12" {...form.register('confirm')} />
          {errors.confirm ? <p className="text-sm text-destructive">{errors.confirm.message}</p> : null}
        </div>
        {errors.root ? <p role="alert" className="text-sm text-destructive">{errors.root.message}</p> : null}
        <Button type="submit" className="h-12 w-full text-base" disabled={isSubmitting}>
          <KeyRound className="size-5" /> {isSubmitting ? 'Saving…' : 'Save password'}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => void signOut()}>
          Sign out instead
        </Button>
      </form>
    </AuthCard>
  )
}
