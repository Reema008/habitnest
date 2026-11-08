import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ThemeMode } from '@/types/models'

export type Point = { x: number; y: number }

type PrefsState = {
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
  /** Dismissed one-time hints (install prompt, iOS push hint, …). */
  dismissed: Record<string, boolean>
  dismiss: (key: string) => void
  /** Show the roaming pet companion on every screen. */
  petCompanion: boolean
  setPetCompanion: (on: boolean) => void
  /** Last place the companion rested (top-left, px), or null for the default corner. */
  petPosition: Point | null
  setPetPosition: (p: Point | null) => void
}

/** Per-device UI preferences (theme is also synced to user_settings when signed in). */
export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      themeMode: 'system',
      setThemeMode: (themeMode) => set({ themeMode }),
      dismissed: {},
      dismiss: (key) => set((s) => ({ dismissed: { ...s.dismissed, [key]: true } })),
      petCompanion: true,
      setPetCompanion: (petCompanion) => set({ petCompanion }),
      petPosition: null,
      setPetPosition: (petPosition) => set({ petPosition }),
    }),
    { name: 'habitnest-prefs', version: 1, migrate: (s) => ({ petCompanion: true, petPosition: null, ...(s as object) }) as PrefsState },
  ),
)
