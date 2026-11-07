import { useEffect } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { toast } from 'sonner'
// Side effect: start listening for `beforeinstallprompt` as soon as the app boots.
import './install-state'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000
const UPDATE_TOAST_ID = 'habitnest-update'

/**
 * Registers the service worker (production builds only) and offers a reload when a new version
 * has been downloaded. Also checks for updates every hour while the app is open.
 */
export function AppUpdatePrompt() {
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
    let timer: ReturnType<typeof setInterval> | undefined
    let active = true

    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        toast('A new version of HabitNest is ready', {
          id: UPDATE_TOAST_ID,
          description: 'Reload to get the latest improvements.',
          duration: Number.POSITIVE_INFINITY,
          action: { label: 'Reload', onClick: () => void updateSW(true) },
        })
      },
      onRegisteredSW(swUrl, registration) {
        if (!registration || !active) return
        timer = setInterval(() => {
          if (registration.installing || !navigator.onLine) return
          // Skip the check when the worker script is unreachable (e.g. captive portals).
          fetch(swUrl, { cache: 'no-store', headers: { 'cache-control': 'no-cache' } })
            .then((res) => (res.ok ? registration.update() : undefined))
            .catch(() => undefined)
        }, UPDATE_CHECK_INTERVAL_MS)
      },
    })

    return () => {
      active = false
      if (timer) clearInterval(timer)
    }
  }, [])

  return null
}
