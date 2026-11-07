import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

/** Built-in avatar presets (used when the member has not uploaded a photo). */
export const AVATAR_PRESETS = [
  { id: 'fox', emoji: '🦊', bg: 'bg-peach' },
  { id: 'panda', emoji: '🐼', bg: 'bg-mint' },
  { id: 'koala', emoji: '🐨', bg: 'bg-sky' },
  { id: 'frog', emoji: '🐸', bg: 'bg-mint' },
  { id: 'owl', emoji: '🦉', bg: 'bg-lemon' },
  { id: 'octopus', emoji: '🐙', bg: 'bg-rose' },
  { id: 'bee', emoji: '🐝', bg: 'bg-lemon' },
  { id: 'unicorn', emoji: '🦄', bg: 'bg-lavender' },
  { id: 'blossom', emoji: '🌸', bg: 'bg-rose' },
  { id: 'rainbow', emoji: '🌈', bg: 'bg-sky' },
  { id: 'star', emoji: '⭐', bg: 'bg-lavender' },
  { id: 'strawberry', emoji: '🍓', bg: 'bg-peach' },
] as const

type AvatarLike = { display_name: string; avatar_url: string | null; avatar_preset: string | null }

export function UserAvatar({
  profile,
  className,
}: {
  profile: AvatarLike | null | undefined
  className?: string
}) {
  const preset = AVATAR_PRESETS.find((p) => p.id === profile?.avatar_preset)
  const initials = (profile?.display_name ?? '?').trim().slice(0, 1).toUpperCase()
  return (
    <Avatar className={cn('size-10 ring-2 ring-glass-border', className)}>
      {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" className="object-cover" /> : null}
      <AvatarFallback className={cn('font-bold', preset?.bg ?? 'bg-lavender')} aria-label={profile?.display_name}>
        {preset ? <span aria-hidden>{preset.emoji}</span> : initials}
      </AvatarFallback>
    </Avatar>
  )
}
