import { Monitor, Moon, Palette, Sun } from 'lucide-react'
import { toast } from 'sonner'
import { useOnline } from '@/components/common/offline-banner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useUpdateSettings } from '@/hooks/use-settings'
import { toUserMessage } from '@/lib/errors'
import { usePrefs } from '@/store/prefs'
import type { ThemeMode } from '@/types/models'
import { SettingsSection } from './settings-section'

const OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

function isThemeMode(v: string): v is ThemeMode {
  return v === 'system' || v === 'light' || v === 'dark'
}

/** Theme picker: applies instantly on this device and syncs to the account when online. */
export function AppearanceSettings() {
  const mode = usePrefs((s) => s.themeMode)
  const setThemeMode = usePrefs((s) => s.setThemeMode)
  const update = useUpdateSettings()
  const online = useOnline()

  const onChange = (value: string) => {
    if (!isThemeMode(value) || value === mode) return
    setThemeMode(value)
    if (!online) return // still applies on this device; synced next time it is changed online
    update.mutate({ theme_mode: value }, { onError: (e) => toast.error(toUserMessage(e)) })
  }

  return (
    <SettingsSection id="appearance" title="Appearance" icon={Palette} description="Choose how HabitNest looks.">
      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={onChange}
        aria-label="Theme"
        variant="outline"
        spacing={2}
        className="grid w-full grid-cols-3"
      >
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <ToggleGroupItem
            key={value}
            value={value}
            aria-label={`${label} theme`}
            className="h-14 flex-col gap-1 rounded-xl text-sm font-semibold aria-checked:bg-lavender/60 data-[state=on]:bg-lavender/60"
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {mode === 'system' ? (
        <p className="text-sm text-muted-foreground">Follows your device's light or dark setting.</p>
      ) : null}
    </SettingsSection>
  )
}
