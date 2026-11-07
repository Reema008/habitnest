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
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolved === 'dark')
    root.style.colorScheme = resolved
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#231c35' : '#f3eefc')
  }, [resolved])
  return children
}
