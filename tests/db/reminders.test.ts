/**
 * Reminder scheduling: local-time windows, opt-in only, incomplete-only logic and
 * duplicate prevention (a reminder is claimed at most once per user/kind/local day).
 */
import { afterAll, beforeAll, expect, test } from 'vitest'
import { admin, asService, asUser, connect, createUser, habitByTemplate, type Db } from './helpers'

let db: Db
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

async function subscribe(userId: string) {
  await asUser(db, userId, `select public.register_push_subscription($1, 'p256', 'auth', 'test')`, [
    `https://push.example.com/${userId}`,
  ])
}

function claim(nowIso: string) {
  return asService<{ user_id: string; kind: string; local_date: string; pending: number }>(db,
    `select user_id, kind, local_date::text, pending from public.claim_due_reminders($1::timestamptz)`, [nowIso])
}

test('daily reminder fires in the user local window exactly once', async () => {
  const u = await createUser(db, undefined, 'Asia/Kolkata') // UTC+5:30
  await subscribe(u.id)
  await asUser(db, u.id, `update public.user_settings set daily_reminder_enabled = true, daily_reminder_time = '20:00' where user_id = $1`, [u.id])

  // 19:59 local (14:29Z) → not yet due.
  expect((await claim('2026-11-10T14:29:00Z')).filter((r) => r.user_id === u.id)).toHaveLength(0)
  // 20:10 local (14:40Z) → due once.
  const first = (await claim('2026-11-10T14:40:00Z')).filter((r) => r.user_id === u.id)
  expect(first).toEqual([expect.objectContaining({ kind: 'daily_reminder', local_date: '2026-11-10' })])
  // Overlapping/repeated runs never send it again that day.
  expect((await claim('2026-11-10T14:45:00Z')).filter((r) => r.user_id === u.id)).toHaveLength(0)
  // Next local day → due again.
  expect((await claim('2026-11-11T14:40:00Z')).filter((r) => r.user_id === u.id)).toHaveLength(1)
})

test('reminders are opt-in and require a push subscription', async () => {
  const u = await createUser(db)
  await asUser(db, u.id, `update public.user_settings set daily_reminder_enabled = true, daily_reminder_time = '09:00' where user_id = $1`, [u.id])
  expect((await claim('2026-11-10T09:05:00Z')).filter((r) => r.user_id === u.id)).toHaveLength(0) // no subscription
  await subscribe(u.id)
  await asUser(db, u.id, `update public.user_settings set daily_reminder_enabled = false where user_id = $1`, [u.id])
  expect((await claim('2026-11-10T09:06:00Z')).filter((r) => r.user_id === u.id)).toHaveLength(0) // disabled
})

test('incomplete reminder only fires while scheduled habits remain', async () => {
  const done = await createUser(db)
  const pending = await createUser(db)
  for (const u of [done, pending]) {
    await subscribe(u.id)
    await asUser(db, u.id,
      `update public.user_settings set incomplete_reminder_enabled = true, incomplete_reminder_time = '21:00' where user_id = $1`, [u.id])
  }
  // "done" completes every habit for that day (written as admin to bypass the future-date check).
  const habits = await admin<{ id: string; template_key: string; current_version: number }>(db,
    `select id, template_key, current_version from public.habits where owner_id = $1`, [done.id])
  const values: Record<string, unknown> = { sleep: { hours: 8 }, exercise: { hours: 1 }, walking: { steps: 8000 }, junk_food: { had_junk_food: 'No' }, water: { litres: 2 } }
  for (const h of habits.rows) {
    await admin(db, `alter table public.habit_entries disable trigger habit_entries_before_write`)
    await admin(db,
      `insert into public.habit_entries (habit_id, user_id, entry_date, habit_version, field_values, is_complete) values ($1, $2, '2026-11-12', $3, $4, true)`,
      [h.id, done.id, h.current_version, JSON.stringify(values[h.template_key])])
    await admin(db, `alter table public.habit_entries enable trigger habit_entries_before_write`)
  }
  const rows = await claim('2026-11-12T21:10:00Z')
  expect(rows.some((r) => r.user_id === done.id)).toBe(false)
  const mine = rows.find((r) => r.user_id === pending.id)
  expect(mine).toMatchObject({ kind: 'incomplete_reminder', pending: 5 })
})

test('push subscription moves to the newest user on a shared device and stays private', async () => {
  const a = await createUser(db)
  const b = await createUser(db)
  const endpoint = `https://push.example.com/shared-${a.id}`
  await asUser(db, a.id, `select public.register_push_subscription($1, 'k', 'a', 'ua')`, [endpoint])
  await asUser(db, b.id, `select public.register_push_subscription($1, 'k', 'a', 'ua')`, [endpoint])
  expect(await asUser(db, a.id, `select * from public.push_subscriptions where endpoint = $1`, [endpoint])).toHaveLength(0)
  expect(await asUser(db, b.id, `select * from public.push_subscriptions where endpoint = $1`, [endpoint])).toHaveLength(1)
  const water = await habitByTemplate(db, b.id, 'water')
  expect(water.id).toBeDefined()
})
