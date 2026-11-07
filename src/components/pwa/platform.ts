/** Browser / platform detection used by install and push guidance. */

type NavigatorWithStandalone = Navigator & { standalone?: boolean }

/** iPhone / iPad (iPadOS reports itself as Mac, so also check for touch). */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

/** Running as an installed app (Home Screen / desktop PWA window). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (navigator as NavigatorWithStandalone).standalone === true
  )
}

/** Safari on iOS (other iOS browsers can also add to Home Screen from iOS 16.4, but via their own menus). */
export function isIOSSafari(): boolean {
  if (!isIOS()) return false
  const ua = navigator.userAgent
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua)
}
