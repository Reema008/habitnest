import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { LockKeyhole } from 'lucide-react'
import { PageHeader } from '@/components/common/page-header'
import { AppearanceSettings } from '@/components/settings/appearance-settings'
import { AppSettings } from '@/components/settings/app-settings'
import { PasskeySettings } from '@/components/settings/passkey-settings'
import { PasswordForm } from '@/components/settings/password-form'
import { PrivacySettings } from '@/components/settings/privacy-settings'
import { ReminderSettings } from '@/components/settings/reminder-settings'
import { SettingsSection } from '@/components/settings/settings-section'
import { Separator } from '@/components/ui/separator'

const SECTIONS = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'reminders', label: 'Reminders' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'security', label: 'Security' },
  { id: 'app', label: 'App' },
] as const

function scrollToSection(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
}

export default function SettingsPage() {
  const { hash } = useLocation()

  useEffect(() => {
    const id = hash.replace(/^#/, '')
    if (id) requestAnimationFrame(() => scrollToSection(id))
  }, [hash])

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" back="/profile" />

      <nav aria-label="Settings sections" className="-mx-4 overflow-x-auto px-4 pb-1">
        <ul className="flex w-max gap-2">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="glass min-h-11 rounded-full px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ring"
                onClick={() => scrollToSection(s.id)}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <AppearanceSettings />
      <ReminderSettings />
      <PrivacySettings />
      <SettingsSection
        id="security"
        title="Security"
        icon={LockKeyhole}
        description="Keep your account safe. Only you should know your password."
      >
        <PasswordForm />
        <Separator />
        <PasskeySettings />
      </SettingsSection>
      <AppSettings />
    </div>
  )
}
