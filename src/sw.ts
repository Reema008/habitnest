/// <reference lib="webworker" />
/**
 * HabitNest service worker (built by vite-plugin-pwa with the injectManifest strategy).
 * - Precaches the app shell and serves index.html for in-scope navigations (offline SPA).
 * - Runtime-caches same-origin images and fonts only. Supabase API/auth/storage responses are
 *   never cached here (the app keeps its own read cache for offline viewing).
 * - Shows Web Push reminders and opens the app at the right screen when one is tapped.
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Every navigation inside the scope gets the app shell; the router handles the path.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin && (request.destination === 'image' || request.destination === 'font'),
  new CacheFirst({
    cacheName: 'habitnest-static-media',
    plugins: [new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30, purgeOnQuotaError: true })],
  }),
)

// The update toast asks the waiting worker to take over.
self.addEventListener('message', (event) => {
  const data: unknown = event.data
  if (data && typeof data === 'object' && (data as { type?: unknown }).type === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
})

// ----------------------------------------------------------------------------------------------
// Web Push
// ----------------------------------------------------------------------------------------------

type PushPayload = { title?: unknown; body?: unknown; url?: unknown; tag?: unknown }

const scopeUrl = () => self.registration.scope

/** Only allow URLs inside the app's scope; anything else opens the app's start page. */
function safeAppUrl(raw: unknown): string {
  const scope = scopeUrl()
  if (typeof raw !== 'string' || raw.length === 0) return scope
  try {
    const url = new URL(raw, scope)
    return url.href.startsWith(scope) ? url.href : scope
  } catch {
    return scope
  }
}

function readPayload(event: PushEvent): PushPayload {
  if (!event.data) return {}
  try {
    const parsed: unknown = event.data.json()
    return parsed && typeof parsed === 'object' ? (parsed as PushPayload) : {}
  } catch {
    return { body: event.data.text() }
  }
}

self.addEventListener('push', (event) => {
  const payload = readPayload(event)
  const title = typeof payload.title === 'string' && payload.title.trim() ? payload.title.slice(0, 120) : 'HabitNest'
  const body = typeof payload.body === 'string' ? payload.body.slice(0, 300) : undefined
  // Same tag ⇒ a newer reminder replaces the older one instead of stacking duplicates.
  const tag = typeof payload.tag === 'string' && payload.tag ? payload.tag.slice(0, 64) : 'habitnest'
  const icon = new URL('pwa-192.png', scopeUrl()).href

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: icon,
      tag,
      data: { url: safeAppUrl(payload.url) },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data: unknown = event.notification.data
  const target = safeAppUrl(data && typeof data === 'object' ? (data as { url?: unknown }).url : undefined)

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = windows.find((c) => c.url.startsWith(scopeUrl()))
      if (existing) {
        try {
          const focused = await existing.focus()
          if (focused.url !== target) await focused.navigate(target)
          return
        } catch {
          // Uncontrolled clients cannot be navigated by the worker; open a fresh window instead.
        }
      }
      await self.clients.openWindow(target)
    })(),
  )
})
