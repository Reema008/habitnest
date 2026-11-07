/**
 * Web Push subscriptions for reminders. The browser subscription is created against the app's
 * service worker with the public VAPID key; the server keeps one row per endpoint
 * (register_push_subscription) and the send-reminders Edge Function delivers to it.
 */
import { supabase } from '@/lib/supabase'
import { env } from '@/lib/env'
import { AppError, unwrap, unwrapMaybe } from '@/lib/errors'

export type PushStatus =
  /** Browser lacks Service Worker / Push / Notification APIs (or not a secure context). */
  | 'unsupported'
  /** No VAPID public key configured for this build. */
  | 'unconfigured'
  /** The user blocked notifications for this site. */
  | 'denied'
  /** This device is subscribed and registered on the server. */
  | 'subscribed'
  /** Supported and allowed (or not yet asked), but not subscribed. */
  | 'unsubscribed'

export type PushDevice = { id: string; user_agent: string | null; created_at: string; last_success_at: string | null }

const SW_READY_TIMEOUT_MS = 10_000

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function isPushConfigured(): boolean {
  return env.vapidPublicKey.trim().length > 0
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
}

/** Converts a URL-safe base64 VAPID key into the byte array PushManager expects. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

/** The registration controlling this page, without hanging when no worker is registered (dev mode). */
async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  return (await navigator.serviceWorker.getRegistration()) ?? null
}

async function readyRegistration(): Promise<ServiceWorkerRegistration> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new AppError("HabitNest's background helper isn't running yet. Reload the app and try again.")),
      SW_READY_TIMEOUT_MS,
    ),
  )
  return Promise.race([navigator.serviceWorker.ready, timeout])
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  const reg = await getRegistration()
  return reg ? reg.pushManager.getSubscription() : null
}

async function isRegisteredOnServer(endpoint: string): Promise<boolean> {
  const row = unwrapMaybe(
    await supabase.from('push_subscriptions').select('id').eq('endpoint', endpoint).maybeSingle(),
  )
  return row !== null
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!isPushConfigured()) return 'unconfigured'
  if (!isPushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const sub = await getCurrentPushSubscription()
  if (!sub || Notification.permission !== 'granted') return 'unsubscribed'
  try {
    return (await isRegisteredOnServer(sub.endpoint)) ? 'subscribed' : 'unsubscribed'
  } catch {
    // Offline or transient error: trust the browser's subscription.
    return 'subscribed'
  }
}

function sameKey(a: ArrayBuffer | null, b: Uint8Array): boolean {
  if (!a) return false
  const x = new Uint8Array(a)
  return x.length === b.length && x.every((v, i) => v === b[i])
}

/** Asks for permission (if needed), subscribes this device and registers it on the server. */
export async function subscribe(): Promise<void> {
  if (!isPushConfigured()) throw new AppError("Push reminders aren't configured yet.")
  if (!isPushSupported()) throw new AppError("This browser can't show notifications.")

  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new AppError(
      permission === 'denied'
        ? 'Notifications are blocked. Allow them in your browser or phone settings to get reminders.'
        : 'Notifications were not allowed.',
    )
  }

  const reg = await readyRegistration()
  const key = urlBase64ToUint8Array(env.vapidPublicKey.trim())
  let sub = await reg.pushManager.getSubscription()
  if (sub && !sameKey(sub.options.applicationServerKey, key)) {
    // The server key changed since this device subscribed: replace the stale subscription.
    await sub.unsubscribe()
    sub = null
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })

  const json = sub.toJSON()
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (!json.endpoint || !p256dh || !auth) {
    throw new AppError('This browser returned an incomplete subscription. Please try again.')
  }
  unwrap(
    await supabase.rpc('register_push_subscription', {
      p_endpoint: json.endpoint,
      p_p256dh: p256dh,
      p_auth: auth,
      p_user_agent: navigator.userAgent,
    }),
  )
}

/** Removes this device's subscription on the server and in the browser. */
export async function unsubscribe(): Promise<void> {
  const sub = await getCurrentPushSubscription()
  if (!sub) return
  unwrap(await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint))
  await sub.unsubscribe()
}

/** Devices (subscriptions) that currently receive my reminders. */
export async function listMyPushDevices(userId: string): Promise<PushDevice[]> {
  return unwrap(
    await supabase
      .from('push_subscriptions')
      .select('id, user_agent, created_at, last_success_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  )
}

/** Shows a local notification through the service worker to confirm notifications work on this device. */
export async function showTestNotification(): Promise<void> {
  if (!isPushSupported() || Notification.permission !== 'granted') {
    throw new AppError('Allow notifications first.')
  }
  const reg = await readyRegistration()
  await reg.showNotification('HabitNest notifications are on 🌿', {
    body: "This is how your reminders will look. You're all set!",
    icon: `${import.meta.env.BASE_URL}pwa-192.png`,
    badge: `${import.meta.env.BASE_URL}pwa-192.png`,
    tag: 'habitnest-test',
    data: { url: `${import.meta.env.BASE_URL}settings` },
  })
}
