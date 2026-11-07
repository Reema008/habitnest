import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Fingerprint, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { useOnline } from '@/components/common/offline-banner'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { passkeysSupported } from '@/api/auth'
import { useDeletePasskey, usePasskeys, useRegisterPasskey, useRenamePasskey } from '@/hooks/use-settings'
import { toUserMessage } from '@/lib/errors'

const NAME_MAX = 120

/** Kind wording for passkey errors (feature disabled on the server, cancelled prompts, …). */
function passkeyError(error: unknown): string {
  const msg = error instanceof Error ? error.message : ''
  if (/not enabled|disabled|not.*found.*passkey|feature|404/i.test(msg)) {
    return "Fingerprint sign-in isn't switched on for HabitNest yet. You can keep using your password."
  }
  return toUserMessage(error, 'Fingerprint sign-in is unavailable right now. Please try again later.')
}

function formatDate(iso: string | undefined): string | null {
  if (!iso) return null
  try {
    return format(parseISO(iso), 'd MMM yyyy')
  } catch {
    return null
  }
}

function RenameDialog({
  passkeyId,
  currentName,
  open,
  onOpenChange,
}: {
  passkeyId: string
  currentName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const online = useOnline()
  const rename = useRenamePasskey()
  const [name, setName] = useState(currentName)
  const trimmed = name.trim()
  const valid = trimmed.length > 0 && trimmed.length <= NAME_MAX

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    rename.mutate(
      { id: passkeyId, name: trimmed },
      {
        onSuccess: () => {
          toast.success('Name saved')
          onOpenChange(false)
        },
        onError: (err) => toast.error(passkeyError(err)),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Rename sign-in</DialogTitle>
            <DialogDescription>Give it a name you'll recognise, like “My phone”.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="passkey-name">Name</Label>
            <Input
              id="passkey-name"
              className="h-12"
              value={name}
              maxLength={NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!valid}
              autoFocus
            />
            {!valid ? <p className="text-sm text-destructive">Enter a name.</p> : null}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" className="h-11">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" className="h-11" disabled={!valid || !online || rename.isPending}>
              {rename.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Fingerprint / Face ID sign-in (passkeys): set up, list, rename and remove. */
export function PasskeySettings() {
  const supported = passkeysSupported()
  const online = useOnline()
  const passkeys = usePasskeys(supported)
  const register = useRegisterPasskey()
  const remove = useDeletePasskey()
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)

  if (!supported) {
    return (
      <div className="space-y-1">
        <h3 className="font-semibold">Fingerprint / Face ID sign-in</h3>
        <p className="text-sm text-muted-foreground">
          This browser or device doesn't support fingerprint or Face ID sign-in. You can keep signing in with your
          username and password.
        </p>
      </div>
    )
  }

  const onRegister = () =>
    register.mutate(undefined, {
      onSuccess: () => toast.success('Fingerprint sign-in is set up on this device'),
      onError: (e) => toast.error(passkeyError(e)),
    })

  const list = passkeys.data ?? []
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="font-semibold">Fingerprint / Face ID sign-in</h3>
        <p className="text-sm text-muted-foreground">
          Sign in with your fingerprint, face or device PIN instead of typing your password.
        </p>
      </div>

      {passkeys.isError ? (
        <div role="status" className="space-y-2 rounded-xl bg-muted/70 p-3 text-sm">
          <p>{passkeyError(passkeys.error)}</p>
          <Button
            variant="ghost"
            className="h-11"
            disabled={passkeys.isFetching}
            onClick={() => void passkeys.refetch()}
          >
            Check again
          </Button>
        </div>
      ) : passkeys.isPending ? (
        <p className="text-sm text-muted-foreground" aria-busy="true">
          Loading your sign-ins…
        </p>
      ) : list.length > 0 ? (
        <ul className="divide-y divide-border rounded-xl bg-muted/50" aria-label="Fingerprint sign-ins">
          {list.map((p) => {
            const name = p.friendly_name?.trim() || 'Unnamed device'
            const created = formatDate(p.created_at)
            const used = formatDate(p.last_used_at)
            return (
              <li key={p.id} className="flex items-center gap-2 py-2 pl-3 pr-1">
                <Fingerprint className="size-5 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{name}</p>
                  <p className="text-xs text-muted-foreground">
                    {created ? `Added ${created}` : null}
                    {used ? ` · Last used ${used}` : null}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 rounded-full"
                  aria-label={`Rename ${name}`}
                  disabled={!online}
                  onClick={() => setRenaming({ id: p.id, name: p.friendly_name ?? '' })}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <ConfirmDialog
                  title="Remove this sign-in?"
                  description={`You won't be able to use “${name}” to sign in any more. Your password still works.`}
                  confirmLabel="Remove"
                  onConfirm={() =>
                    remove.mutate(p.id, {
                      onSuccess: () => toast.success('Sign-in removed'),
                      onError: (e) => toast.error(passkeyError(e)),
                    })
                  }
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11 rounded-full text-destructive"
                      aria-label={`Remove ${name}`}
                      disabled={!online || remove.isPending}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  }
                />
              </li>
            )
          })}
        </ul>
      ) : null}

      {!passkeys.isError ? (
        <Button variant="secondary" className="h-12 w-full" disabled={!online || register.isPending} onClick={onRegister}>
          <Fingerprint className="size-5" aria-hidden />
          {register.isPending ? 'Waiting for your device…' : list.length > 0 ? 'Add another device' : 'Set up fingerprint sign-in'}
        </Button>
      ) : null}

      {renaming ? (
        <RenameDialog
          key={renaming.id}
          passkeyId={renaming.id}
          currentName={renaming.name}
          open
          onOpenChange={(open) => {
            if (!open) setRenaming(null)
          }}
        />
      ) : null}
    </div>
  )
}
