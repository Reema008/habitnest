/**
 * Back destination for secondary screens: history back when the user navigated here inside the app,
 * otherwise a sensible fallback (deep links / app launches have no in-app history).
 */
export function backTarget(fallback: string): string | true {
  if (typeof window === 'undefined') return fallback
  const idx = (window.history.state as { idx?: unknown } | null)?.idx
  return typeof idx === 'number' && idx > 0 ? true : fallback
}
