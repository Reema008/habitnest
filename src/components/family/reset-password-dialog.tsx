import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { useOnline } from '@/components/common/offline-banner'
import { resetMemberPassword } from '@/api/admin'
import { toUserMessage } from '@/lib/errors'
import { CopyButton } from './copy-button'

/**
 * Admin action: create a temporary password for a member who forgot theirs. The password is shown
 * exactly once; the member is asked to choose a new one at their next sign-in.
 */
export function ResetPasswordDialog({ userId, displayName }: { userId: string; displayName: string }) {
  const [open, setOpen] = useState(false)
  const online = useOnline()
  const reset = useMutation({ mutationFn: () => resetMemberPassword(userId) })
  const password = reset.data

  function onOpenChange(next: boolean) {
    setOpen(next)
    // Forget the temporary password as soon as the dialog closes.
    if (!next) reset.reset()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="h-11 w-full justify-start gap-2" disabled={!online}>
          <KeyRound className="size-4" aria-hidden /> Reset password
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            {password ? `Temporary password for ${displayName}` : `Reset ${displayName}'s password?`}
          </DialogTitle>
          <DialogDescription>
            {password
              ? `Give this to ${displayName} in person or by message. They'll sign in with it and then choose a new password straight away.`
              : `This creates a one-time temporary password. ${displayName}'s current password stops working, and they'll be asked to choose a new one the next time they sign in.`}
          </DialogDescription>
        </DialogHeader>

        {password ? (
          <div className="space-y-3">
            <p
              className="rounded-2xl bg-lavender/40 p-4 text-center font-mono text-2xl font-bold tracking-wider break-all select-all"
              aria-label="Temporary password"
            >
              {password}
            </p>
            <CopyButton text={password} label="Copy password" successMessage="Temporary password copied" variant="default" className="w-full" />
            <p className="flex gap-2 rounded-xl bg-lemon/40 p-3 text-xs">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>This password is shown only once. If it gets lost, you can simply reset it again.</span>
            </p>
          </div>
        ) : reset.error ? (
          <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            {toUserMessage(reset.error)}
          </p>
        ) : null}

        <DialogFooter className="mx-0 mb-0 rounded-none border-0 bg-transparent p-0">
          <DialogClose asChild>
            <Button type="button" variant="secondary" className="h-11">
              {password ? 'Done' : 'Cancel'}
            </Button>
          </DialogClose>
          {password ? null : (
            <Button type="button" className="h-11" disabled={!online || reset.isPending} onClick={() => reset.mutate()}>
              {reset.isPending ? 'Resetting…' : reset.error ? 'Try again' : 'Create temporary password'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
