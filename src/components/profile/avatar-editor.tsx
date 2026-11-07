import { useRef, useState } from 'react'
import { Camera, ImageUp, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { useOnline } from '@/components/common/offline-banner'
import { AVATAR_PRESETS, UserAvatar } from '@/components/common/user-avatar'
import { useUpdateProfile, useUploadAvatar } from '@/hooks/use-profile'
import { toUserMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types/models'

const ACCEPT = 'image/jpeg,image/png,image/webp'

/** Large avatar with a drawer to upload a photo, pick a preset or remove the photo. */
export function AvatarEditor({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false)
  const online = useOnline()
  const update = useUpdateProfile()
  const upload = useUploadAvatar()
  const fileInput = useRef<HTMLInputElement>(null)
  const busy = update.isPending || upload.isPending
  const disabled = !online || busy

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow choosing the same file again
    if (!file) return
    upload.mutate(file, {
      onSuccess: () => {
        toast.success('Looking great! Your photo is updated.')
        setOpen(false)
      },
      onError: (err) => toast.error(toUserMessage(err)),
    })
  }

  function choosePreset(id: string) {
    update.mutate(
      { avatar_preset: id, avatar_url: null },
      {
        onSuccess: () => toast.success('Avatar updated'),
        onError: (err) => toast.error(toUserMessage(err)),
      },
    )
  }

  function removePhoto() {
    update.mutate(
      { avatar_url: null },
      {
        onSuccess: () => toast.success('Photo removed'),
        onError: (err) => toast.error(toUserMessage(err)),
      },
    )
  }

  // Show the preset being saved straight away.
  const pendingPreset = update.isPending ? update.variables?.avatar_preset : undefined
  const selectedPreset = profile.avatar_url ? null : (pendingPreset ?? profile.avatar_preset)

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button
          type="button"
          aria-label="Change avatar"
          className="relative shrink-0 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
        >
          <UserAvatar profile={profile} className="size-24 text-4xl" />
          <span className="absolute -bottom-0.5 -right-0.5 flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-3 ring-background">
            <Camera className="size-4.5" aria-hidden />
          </span>
        </button>
      </DrawerTrigger>
      <DrawerContent className="mx-auto max-w-lg">
        <DrawerHeader>
          <DrawerTitle className="text-lg font-extrabold">Your avatar</DrawerTitle>
          <DrawerDescription>Upload a photo or pick a friendly preset.</DrawerDescription>
        </DrawerHeader>
        <div className="space-y-5 overflow-y-auto px-4 pb-8">
          {!online ? (
            <p role="status" className="rounded-xl bg-lemon/60 px-3 py-2 text-sm font-semibold">
              You're offline — avatar changes will be possible once you reconnect.
            </p>
          ) : null}
          <div className="flex justify-center">
            <UserAvatar profile={profile} className="size-28 text-5xl" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input ref={fileInput} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden onChange={onFile} />
            <Button className="h-12 rounded-2xl" disabled={disabled} onClick={() => fileInput.current?.click()}>
              <ImageUp className="size-5" aria-hidden /> {upload.isPending ? 'Uploading…' : 'Upload photo'}
            </Button>
            <Button
              variant="secondary"
              className="h-12 rounded-2xl"
              disabled={disabled || !profile.avatar_url}
              onClick={removePhoto}
            >
              <Trash2 className="size-5" aria-hidden /> Remove photo
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground">JPEG, PNG or WebP. We resize it for you.</p>
          <fieldset className="space-y-2" disabled={disabled}>
            <legend className="mb-2 text-sm font-bold">Or choose a preset</legend>
            <div className="grid grid-cols-4 gap-2 min-[400px]:grid-cols-6">
              {AVATAR_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-label={`${p.id} avatar`}
                  aria-pressed={selectedPreset === p.id}
                  onClick={() => choosePreset(p.id)}
                  className={cn(
                    'flex aspect-square min-h-11 items-center justify-center rounded-2xl text-2xl outline-none transition',
                    'focus-visible:ring-3 focus-visible:ring-ring/60 disabled:opacity-50',
                    p.bg,
                    selectedPreset === p.id ? 'ring-3 ring-primary' : 'opacity-85 hover:opacity-100',
                  )}
                >
                  <span aria-hidden>{p.emoji}</span>
                </button>
              ))}
            </div>
          </fieldset>
          {profile.avatar_url ? (
            <p className="text-xs text-muted-foreground">Choosing a preset replaces your photo.</p>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
