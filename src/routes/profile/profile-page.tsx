import { useState } from 'react'
import { useNavigate } from 'react-router'
import { AtSign, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/common/glass-card'
import { PageHeader } from '@/components/common/page-header'
import { AvatarEditor } from '@/components/profile/avatar-editor'
import { BadgesGrid } from '@/components/profile/badges-grid'
import { DisplayNameForm } from '@/components/profile/display-name-form'
import { PetPreviewCard, ProfileLinks } from '@/components/profile/profile-links'
import { signOut } from '@/api/auth'
import { toUserMessage } from '@/lib/errors'
import { useCurrentUser } from '@/providers/auth-provider'

export default function ProfilePage() {
  const { userId, profile } = useCurrentUser()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)

  async function onSignOut() {
    setSigningOut(true)
    try {
      await signOut()
      navigate('/sign-in', { replace: true })
    } catch (e) {
      toast.error(toUserMessage(e))
      setSigningOut(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Profile" subtitle="You, your companion and your badges" />

      <GlassCard as="section" aria-label="Your details" className="space-y-5 p-5">
        <div className="flex items-center gap-4">
          <AvatarEditor profile={profile} />
          <div className="min-w-0">
            <p className="truncate text-xl font-extrabold">{profile.display_name}</p>
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <AtSign className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">
                <span className="font-semibold text-foreground">{profile.username}</span> — used to sign in
              </span>
            </p>
          </div>
        </div>
        <DisplayNameForm key={profile.display_name} displayName={profile.display_name} />
      </GlassCard>

      <PetPreviewCard pet={profile.pet_type} />

      <section aria-labelledby="badges-heading" className="space-y-2">
        <h2 id="badges-heading" className="text-lg font-extrabold">
          Badges
        </h2>
        <BadgesGrid userId={userId} />
      </section>

      <ProfileLinks />

      <Button variant="destructive" className="h-12 w-full rounded-2xl text-base" onClick={() => void onSignOut()} disabled={signingOut}>
        <LogOut className="size-5" aria-hidden /> {signingOut ? 'Signing out…' : 'Sign out'}
      </Button>
    </div>
  )
}
