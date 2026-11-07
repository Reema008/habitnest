import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ThemeMode } from '@/types/models'

type PrefsState = {
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
  /** Dismissed one-time hints (install prompt, iOS push hint, …). */
  dismissed: Record<string, boolean>
  dismiss: (key: string) => void
}

/** Per-device UI preferences (theme is also synced to user_settings when signed in). */
export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      themeMode: 'system',
      setThemeMode: (themeMode) => set({ themeMode }),
      dismissed: {},
      dismiss: (key) => set((s) => ({ dismissed: { ...s.dismissed, [key]: true } })),
    }),
    { name: 'habitnest-prefs' },
  ),
)
