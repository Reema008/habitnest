import { Check, Monitor, Moon, Palette, Sun } from 'lucide-react'
import { toast } from 'sonner'
import { useOnline } from '@/components/common/offline-banner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useUpdateSettings } from '@/hooks/use-settings'
import { toUserMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { useResolvedTheme } from '@/providers/theme-provider'
import { usePrefs } from '@/store/prefs'
import { THEMES, type ThemeName } from '@/theme/themes'
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

/** Theme + light/dark picker: applies instantly on this device; light/dark syncs to the account. */
export function AppearanceSettings() {
  const mode = usePrefs((s) => s.themeMode)
  const setThemeMode = usePrefs((s) => s.setThemeMode)
  const themeName = usePrefs((s) => s.themeName)
  const setThemeName = usePrefs((s) => s.setThemeName)
  const resolved = useResolvedTheme()
  const update = useUpdateSettings()
  const online = useOnline()

  const onModeChange = (value: string) => {
    if (!isThemeMode(value) || value === mode) return
    setThemeMode(value)
    if (!online) return // still applies on this device; synced next time it is changed online
    update.mutate({ theme_mode: value }, { onError: (e) => toast.error(toUserMessage(e)) })
  }

  return (
    <SettingsSection id="appearance" title="Appearance" icon={Palette} description="Choose how HabitNest looks.">
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-3">
        {THEMES.map((t) => (
          <ThemeCard
            key={t.id}
            id={t.id}
            name={t.name}
            description={t.description}
            dark={resolved === 'dark'}
            selected={themeName === t.id}
            onSelect={() => setThemeName(t.id)}
          />
        ))}
      </div>

      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={onModeChange}
        aria-label="Light or dark"
        variant="outline"
        spacing={2}
        className="grid w-full grid-cols-3"
      >
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <ToggleGroupItem
            key={value}
            value={value}
            aria-label={`${label} mode`}
            className="h-14 flex-col gap-1 rounded-xl text-sm font-semibold data-[state=on]:bg-primary/15 data-[state=on]:text-foreground"
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {mode === 'system' ? (
        <p className="text-sm text-muted-foreground">Light or dark follows your device setting.</p>
      ) : null}
    </SettingsSection>
  )
}

/** A selectable card that renders a live miniature of the theme (its own tokens, glass and font). */
function ThemeCard({
  id, name, description, dark, selected, onSelect,
}: {
  id: ThemeName
  name: string
  description: string
  dark: boolean
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`${name} theme. ${description}`}
      onClick={onSelect}
      className={cn(
        'group rounded-2xl p-1.5 text-left outline-none transition focus-visible:ring-3 focus-visible:ring-ring/60',
        selected ? 'bg-primary/15 ring-2 ring-primary' : 'hover:bg-foreground/5',
      )}
    >
      {/* Theme tokens are scoped to this box via data-theme (+ .dark). */}
      <div
        data-theme={id}
        className={cn('relative h-28 overflow-hidden rounded-xl', dark && 'dark')}
        style={{ backgroundColor: 'var(--background)', backgroundImage: 'var(--app-gradient)', color: 'var(--foreground)' }}
        aria-hidden
      >
        <span className="absolute -left-6 -top-8 size-24 rounded-full blur-xl" style={{ background: 'var(--orb-1)', opacity: 'var(--orb-opacity)' }} />
        <span className="absolute -bottom-10 -right-6 size-24 rounded-full blur-xl" style={{ background: 'var(--orb-3)', opacity: 'var(--orb-opacity)' }} />
        <div className="glass absolute inset-x-2.5 top-2.5 rounded-[calc(var(--radius)*0.8)] p-2.5">
          <p className="text-lg leading-none font-bold" style={{ fontFamily: 'var(--app-font-heading)' }}>
            Aa
          </p>
          <p className="mt-1 text-[10px] leading-tight text-muted-foreground" style={{ fontFamily: 'var(--app-font)' }}>
            Today’s habits
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="h-2 w-10 rounded-full bg-primary" />
            <span className="size-2 rounded-full" style={{ background: 'var(--chart-2)' }} />
            <span className="size-2 rounded-full" style={{ background: 'var(--chart-3)' }} />
            <span className="size-2 rounded-full" style={{ background: 'var(--chart-5)' }} />
          </div>
        </div>
        {selected ? (
          <span className="absolute bottom-2 right-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-4" />
          </span>
        ) : null}
      </div>
      <p className="mt-2 px-1 text-sm font-semibold">{name}</p>
      <p className="line-clamp-2 px-1 text-xs text-muted-foreground">{description}</p>
    </button>
  )
}
