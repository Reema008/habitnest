import { useSyncExternalStore } from 'react'
import { WifiOff } from 'lucide-react'

function subscribe(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
}

/** Shown while offline: cached data stays readable, saving is paused. */
export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div role="status" className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-lemon px-4 py-2 text-sm font-semibold text-foreground">
      <WifiOff className="size-4" aria-hidden />
      You're offline — showing saved data. Changes will be possible once you reconnect.
    </div>
  )
}
