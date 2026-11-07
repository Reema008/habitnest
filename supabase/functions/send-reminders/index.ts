/**
 * send-reminders — invoked every 15 minutes by pg_cron (see migration 20261108000009_reminders.sql).
 *
 * 1. Verifies the `x-cron-secret` header against the Vault secret (constant-time compare).
 * 2. Claims due reminders atomically (claim_due_reminders dedupes per user/kind/local day).
 * 3. Sends a Web Push notification to each of the user's subscriptions; removes subscriptions
 *    the push service reports as gone (404/410) and records successful deliveries.
 *
 * Secrets come from Supabase Vault via get_reminder_secrets() (service role only). Nothing secret,
 * and no full push endpoint, is ever logged or returned.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
// @deno-types="npm:@types/web-push@3.6.4"
import webpush from 'npm:web-push@3.6.7'

const APP_URL = 'https://reema008.github.io/habitnest/'
const TRACK_URL = `${APP_URL}track`
const DEFAULT_VAPID_SUBJECT = APP_URL
const SEND_CONCURRENCY = 20
const PUSH_TTL_SECONDS = 4 * 60 * 60

type ReminderKind = 'daily_reminder' | 'incomplete_reminder'
type DueReminder = { user_id: string; kind: ReminderKind; local_date: string; pending: number }
type SubscriptionRow = { id: string; user_id: string; endpoint: string; p256dh: string; auth_key: string }
type PushMessage = { title: string; body: string; url: string; tag: string }
type Secrets = {
  cron_secret: string | null
  vapid_public_key: string | null
  vapid_private_key: string | null
  vapid_subject: string | null
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

/** Constant-time string comparison (hashing first makes the lengths equal). */
async function secretsMatch(provided: string, expected: string): Promise<boolean> {
  const enc = new TextEncoder()
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(provided)),
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
  ])
  const x = new Uint8Array(a)
  const y = new Uint8Array(b)
  let diff = 0
  for (let i = 0; i < x.length; i += 1) diff |= x[i] ^ y[i]
  return diff === 0
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function buildMessage(reminder: DueReminder): PushMessage {
  const pending = Math.max(0, Math.floor(reminder.pending))
  if (reminder.kind === 'daily_reminder') {
    return {
      title: 'Time to check in 🌿',
      body:
        pending > 0
          ? `A gentle nudge to log today's habits. ${plural(pending, 'habit')} to go today.`
          : "A gentle nudge to log today's habits.",
      url: TRACK_URL,
      tag: 'habitnest-daily',
    }
  }
  return {
    title: 'Still time today 🌙',
    body: `You have ${plural(Math.max(1, pending), 'habit')} left today — no pressure, every bit counts.`,
    url: TRACK_URL,
    tag: 'habitnest-incomplete',
  }
}

/** Host only — enough to debug without exposing the capability URL. */
function redact(endpoint: string): string {
  try {
    return new URL(endpoint).host
  } catch {
    return 'invalid-endpoint'
  }
}

function isDueReminder(row: unknown): row is DueReminder {
  if (!row || typeof row !== 'object') return false
  const r = row as Record<string, unknown>
  return (
    typeof r.user_id === 'string' &&
    (r.kind === 'daily_reminder' || r.kind === 'incomplete_reminder') &&
    typeof r.local_date === 'string' &&
    typeof r.pending === 'number'
  )
}

function statusOf(error: unknown): number | null {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const code = (error as { statusCode: unknown }).statusCode
    return typeof code === 'number' ? code : null
  }
  return null
}

async function inBatches<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.allSettled(items.slice(i, i + size).map(fn))
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json({ error: 'Server is not configured' }, 500)

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const { data: secretRows, error: secretsError } = await admin.rpc('get_reminder_secrets')
  if (secretsError) {
    console.error('send-reminders: could not read secrets', secretsError.code ?? '')
    return json({ error: 'Server is not configured' }, 500)
  }
  const secrets = ((Array.isArray(secretRows) ? secretRows[0] : secretRows) ?? null) as Secrets | null
  if (!secrets?.cron_secret) return json({ error: 'Reminders are not configured' }, 503)

  const provided = req.headers.get('x-cron-secret') ?? ''
  if (!provided || !(await secretsMatch(provided, secrets.cron_secret))) {
    return json({ error: 'Unauthorized' }, 401)
  }

  if (!secrets.vapid_public_key || !secrets.vapid_private_key) {
    return json({ error: 'Push keys are not configured' }, 503)
  }
  webpush.setVapidDetails(
    secrets.vapid_subject?.trim() || DEFAULT_VAPID_SUBJECT,
    secrets.vapid_public_key,
    secrets.vapid_private_key,
  )

  const { data: claimedRows, error: claimError } = await admin.rpc('claim_due_reminders')
  if (claimError) {
    console.error('send-reminders: claim failed', claimError.code ?? '', claimError.message)
    return json({ error: 'Could not claim reminders' }, 500)
  }
  const due = (Array.isArray(claimedRows) ? claimedRows : []).filter(isDueReminder)
  if (due.length === 0) return json({ claimed: 0, sent: 0, removed: 0 })

  const userIds = [...new Set(due.map((d) => d.user_id))]
  const { data: subRows, error: subsError } = await admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth_key')
    .in('user_id', userIds)
  if (subsError) {
    console.error('send-reminders: could not load subscriptions', subsError.code ?? '')
    return json({ error: 'Could not load subscriptions' }, 500)
  }

  const byUser = new Map<string, SubscriptionRow[]>()
  for (const s of (subRows ?? []) as SubscriptionRow[]) {
    const list = byUser.get(s.user_id) ?? []
    list.push(s)
    byUser.set(s.user_id, list)
  }

  const jobs = due.flatMap((reminder) =>
    (byUser.get(reminder.user_id) ?? []).map((sub) => ({ sub, message: buildMessage(reminder) })),
  )

  let sent = 0
  let failed = 0
  const delivered = new Set<string>()
  const gone = new Set<string>()

  await inBatches(jobs, SEND_CONCURRENCY, async ({ sub, message }) => {
    if (gone.has(sub.id)) return
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        JSON.stringify(message),
        { TTL: PUSH_TTL_SECONDS, urgency: 'normal', topic: message.tag },
      )
      sent += 1
      delivered.add(sub.id)
    } catch (error) {
      const status = statusOf(error)
      if (status === 404 || status === 410) {
        gone.add(sub.id)
      } else {
        failed += 1
        console.warn(`send-reminders: push to ${redact(sub.endpoint)} failed (status ${status ?? 'unknown'})`)
      }
    }
  })

  if (gone.size > 0) {
    const { error } = await admin.from('push_subscriptions').delete().in('id', [...gone])
    if (error) console.error('send-reminders: could not remove expired subscriptions', error.code ?? '')
  }
  const succeeded = [...delivered].filter((id) => !gone.has(id))
  if (succeeded.length > 0) {
    const { error } = await admin
      .from('push_subscriptions')
      .update({ last_success_at: new Date().toISOString() })
      .in('id', succeeded)
    if (error) console.error('send-reminders: could not record deliveries', error.code ?? '')
  }

  if (failed > 0) console.warn(`send-reminders: ${failed} deliveries failed`)
  return json({ claimed: due.length, sent, removed: gone.size })
})
