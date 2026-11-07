/**
 * Captures the browser's `beforeinstallprompt` event as early as possible (this module is imported
 * by the always-mounted AppUpdatePrompt) so install UI rendered later can still use it.
 */
import { useSyncExternalStore } from 'react'
import { isIOS, isIOSSafari, isStandalone } from './platform'

type InstallOutcome = 'accepted' | 'dismissed'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: InstallOutcome; platform: string }>
}

export type InstallState = {
  /** Running as an installed app, or installed during this session. */
  installed: boolean
  /** The browser offered a native install prompt we can show. */
  canPrompt: boolean
  /** iOS without the native prompt: show "Share → Add to Home Screen" instructions. */
  iosManual: boolean
  /** On iOS but not in Safari (Add to Home Screen lives in Safari's share sheet). */
  iosNeedsSafari: boolean
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
let installedThisSession = false
const listeners = new Set<() => void>()

function computeState(): InstallState {
  const installed = installedThisSession || isStandalone()
  const ios = isIOS()
  return {
    installed,
    canPrompt: !installed && deferredPrompt !== null,
    iosManual: !installed && ios,
    iosNeedsSafari: !installed && ios && !isIOSSafari(),
  }
}

const serverState: InstallState = { installed: false, canPrompt: false, iosManual: false, iosNeedsSafari: false }
let snapshot: InstallState = typeof window === 'undefined' ? serverState : computeState()

function emit() {
  snapshot = computeState()
  listeners.forEach((l) => l())
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault() // we show our own, dismissible install card instead of the mini-infobar
    deferredPrompt = event as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    installedThisSession = true
    emit()
  })
  window.matchMedia('(display-mode: standalone)').addEventListener('change', emit)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribe, () => snapshot, () => serverState)
}

/** Shows the native install prompt. The event can only be used once. */
export async function promptInstall(): Promise<InstallOutcome | 'unavailable'> {
  const event = deferredPrompt
  if (!event) return 'unavailable'
  deferredPrompt = null
  emit()
  await event.prompt()
  const { outcome } = await event.userChoice
  return outcome
}
