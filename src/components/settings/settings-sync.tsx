import { useEffect } from 'react'
import { useSettings } from '@/hooks/use-settings'
import { useAuth } from '@/providers/auth-provider'
import { usePrefs } from '@/store/prefs'

/** Users whose server theme has already been applied during this page load. */
const appliedFor = new Set<string>()

/**
 * Applies the signed-in user's saved theme (user_settings.theme_mode) to this device once per
 * sign-in, after a fresh fetch (never from a possibly stale persisted cache). Renders nothing.
 */
export function SettingsSync() {
  const { userId } = useAuth()
  const { data, isFetchedAfterMount } = useSettings()
  const setThemeMode = usePrefs((s) => s.setThemeMode)

  useEffect(() => {
    if (!userId || !data || !isFetchedAfterMount || appliedFor.has(userId)) return
    appliedFor.add(userId)
    setThemeMode(data.theme_mode)
  }, [userId, data, isFetchedAfterMount, setThemeMode])

  return null
}
