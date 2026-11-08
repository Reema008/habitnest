import { useEffect, useSyncExternalStore } from 'react'
import { usePrefs } from '@/store/prefs'

const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

function subscribe(cb: () => void) {
  media?.addEventListener('change', cb)
  return () => media?.removeEventListener('change', cb)
}

export function useSystemPrefersDark(): boolean {
  return useSyncExternalStore(subscribe, () => media?.matches ?? false, () => false)
}

/** Resolved theme ("light" | "dark") after applying the System option. */
export function useResolvedTheme(): 'light' | 'dark' {
  const mode = usePrefs((s) => s.themeMode)
  const systemDark = useSystemPrefersDark()
  return mode === 'system' ? (systemDark ? 'dark' : 'light') : mode
}

/** Applies the `dark` class and browser theme-color for the current theme. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const resolved = useResolvedTheme()
  const themeName = usePrefs((s) => s.themeName)
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = themeName
    root.classList.toggle('dark', resolved === 'dark')
    root.style.colorScheme = resolved
    // Match the browser UI colour to the theme background.
    const bg = getComputedStyle(root).getPropertyValue('--background').trim()
    if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
  }, [resolved, themeName])
  return children
}
