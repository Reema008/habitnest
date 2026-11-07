import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useOnline } from '@/components/common/offline-banner'
import { useUpdateProfile } from '@/hooks/use-profile'
import { toUserMessage } from '@/lib/errors'

const schema = z.object({
  displayName: z.string().trim().min(1, 'Enter a name').max(40, 'Keep it to 40 characters or fewer'),
})
type Values = z.infer<typeof schema>

/** Inline display-name editor (1–40 characters). */
export function DisplayNameForm({ displayName }: { displayName: string }) {
  const online = useOnline()
  const update = useUpdateProfile()
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { displayName }, mode: 'onChange' })
  const current = useWatch({ control: form.control, name: 'displayName' })
  const unchanged = current.trim() === displayName
  const { errors } = form.formState

  const onSubmit = form.handleSubmit(async ({ displayName: next }) => {
    try {
      const saved = await update.mutateAsync({ display_name: next })
      form.reset({ displayName: saved.display_name })
      toast.success('Name updated')
    } catch (e) {
      toast.error(toUserMessage(e))
    }
  })

  return (
    <form onSubmit={onSubmit} className="space-y-2" noValidate>
      <Label htmlFor="profile-display-name">Display name</Label>
      <div className="flex gap-2">
        <Input
          id="profile-display-name"
          autoComplete="nickname"
          maxLength={40}
          className="h-12 flex-1"
          aria-invalid={!!errors.displayName}
          aria-describedby={errors.displayName ? 'profile-display-name-error' : undefined}
          {...form.register('displayName')}
        />
        <Button type="submit" className="h-12 px-5" disabled={!online || unchanged || update.isPending}>
          {update.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
      {errors.displayName ? (
        <p id="profile-display-name-error" className="text-sm text-destructive">
          {errors.displayName.message}
        </p>
      ) : null}
    </form>
  )
}
