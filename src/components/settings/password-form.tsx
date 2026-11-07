import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { useOnline } from '@/components/common/offline-banner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PASSWORD_MIN_LENGTH, changePassword } from '@/api/auth'
import { toUserMessage } from '@/lib/errors'

const schema = z
  .object({
    password: z.string().min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`).max(72, 'Use at most 72 characters'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })
type Values = z.infer<typeof schema>

/** Change password (signed in). */
export function PasswordForm() {
  const online = useOnline()
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '' } })

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await changePassword(v.password)
      form.reset()
      toast.success('Password updated')
    } catch (e) {
      form.setError('root', { message: toUserMessage(e) })
    }
  })

  const { errors, isSubmitting } = form.formState
  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate aria-labelledby="password-title">
      <h3 id="password-title" className="font-semibold">
        Change password
      </h3>
      <div className="space-y-1.5">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          className="h-12"
          aria-invalid={!!errors.password}
          {...form.register('password')}
        />
        {errors.password ? <p className="text-sm text-destructive">{errors.password.message}</p> : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          className="h-12"
          aria-invalid={!!errors.confirm}
          {...form.register('confirm')}
        />
        {errors.confirm ? <p className="text-sm text-destructive">{errors.confirm.message}</p> : null}
      </div>
      {errors.root ? (
        <p role="alert" className="text-sm text-destructive">
          {errors.root.message}
        </p>
      ) : null}
      <Button type="submit" className="h-12 w-full" disabled={isSubmitting || !online}>
        <KeyRound className="size-4" aria-hidden /> {isSubmitting ? 'Saving…' : 'Update password'}
      </Button>
    </form>
  )
}
