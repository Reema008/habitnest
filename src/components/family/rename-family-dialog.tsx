import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useOnline } from '@/components/common/offline-banner'
import { useRenameFamily } from '@/hooks/use-family'
import { toUserMessage } from '@/lib/errors'

/** Admin-only: rename the family. */
export function RenameFamilyDialog({ familyId, currentName }: { familyId: string; currentName: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(currentName)
  const online = useOnline()
  const rename = useRenameFamily()
  const trimmed = name.trim()
  const error = !trimmed ? 'Give your family a name.' : trimmed.length > 50 ? 'Keep the name under 50 characters.' : null

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (error) return
    try {
      await rename.mutateAsync({ familyId, name: trimmed })
      toast.success('Family name updated')
      setOpen(false)
    } catch (err) {
      toast.error(toUserMessage(err))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setName(currentName)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11 rounded-full" aria-label="Rename family" disabled={!online}>
          <Pencil className="size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl" showCloseButton={false}>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Rename family</DialogTitle>
            <DialogDescription>Everyone in the family will see the new name.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-family">Family name</Label>
            <Input
              id="rename-family"
              className="h-12"
              maxLength={50}
              value={name}
              aria-invalid={!!error}
              aria-describedby={error ? 'rename-family-error' : undefined}
              onChange={(e) => setName(e.target.value)}
            />
            {error ? (
              <p id="rename-family-error" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter className="mx-0 mb-0 rounded-none border-0 bg-transparent p-0">
            <DialogClose asChild>
              <Button type="button" variant="secondary" className="h-11">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" className="h-11" disabled={!!error || !online || rename.isPending}>
              {rename.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
