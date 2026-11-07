/**
 * Live smoke test against the configured Supabase project (reads .env).
 *   node scripts/live-smoke.ts
 * Creates two throwaway users (usernames start with "smoke_") and exercises the real API with the
 * public key only — exactly what the app can do. Prints the cleanup SQL at the end.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  fs.readFileSync(path.resolve(import.meta.dirname, '../.env'), 'utf8')
    .split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const URL = env.VITE_SUPABASE_URL!
const KEY = env.VITE_SUPABASE_ANON_KEY!
const DOMAIN = env.VITE_AUTH_EMAIL_DOMAIN || 'users.habitnest.invalid'

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

function client() {
  return createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function signUp(username: string): Promise<{ db: SupabaseClient; id: string }> {
  const db = client()
  const { data, error } = await db.auth.signUp({
    email: `${username}@${DOMAIN}`,
    password: `Smoke-${crypto.randomUUID()}`,
    options: { data: { username, display_name: username, timezone: 'UTC' } },
  })
  if (error || !data.session) throw new Error(`sign-up failed for ${username}: ${error?.message ?? 'no session'}`)
  return { db, id: data.user!.id }
}

const today = new Date().toISOString().slice(0, 10)
const suffix = Math.random().toString(36).slice(2, 8)

async function main() {
  const anon = client()
  const a = await signUp(`smoke_a_${suffix}`)
  const b = await signUp(`smoke_b_${suffix}`)

  // Defaults
  const { data: aHabits } = await a.db.from('habits').select('id, template_key, visibility, current_version').eq('owner_id', a.id)
  check('sign-up creates 5 private default habits', aHabits?.length === 5 && aHabits.every((h) => h.visibility === 'private'))
  const water = aHabits!.find((h) => h.template_key === 'water')!
  const sleep = aHabits!.find((h) => h.template_key === 'sleep')!

  // Family
  const { data: famId, error: famErr } = await a.db.rpc('create_family', { p_name: `Smoke ${suffix}` })
  check('create family', !famErr && !!famId, famErr?.message)
  const { data: inv } = await a.db.rpc('create_invitation', { p_max_uses: 2, p_valid_days: 1 })
  const code = inv?.[0]?.code ?? ''
  const { data: preview } = await b.db.rpc('preview_invitation', { p_code: code })
  check('invite preview', preview?.[0]?.member_count === 1)
  const { data: joined } = await b.db.rpc('join_family', { p_code: code })
  check('join with invite code', joined === famId)
  const { data: bad } = await b.db.rpc('join_family', { p_code: 'ZZZZZZZZZZ' })
  check('bad invite code returns null', bad === null)

  // Entries (upsert twice = re-save)
  const save = (litres: number) =>
    a.db.from('habit_entries').upsert(
      { habit_id: water.id, entry_date: today, habit_version: water.current_version, field_values: { litres } },
      { onConflict: 'habit_id,entry_date' },
    ).select('is_complete').single()
  const s1 = await save(1)
  const s2 = await save(2.5)
  check('record + re-save entry (upsert)', !s1.error && !s2.error && s2.data?.is_complete === true, s2.error?.message)
  const s3 = await a.db.from('habit_entries').upsert(
    { habit_id: sleep.id, entry_date: today, habit_version: sleep.current_version, field_values: { hours: 7.5 } },
    { onConflict: 'habit_id,entry_date' }).select('is_complete').single()
  check('private habit entry saved', !s3.error && s3.data?.is_complete === true)
  const tooMuch = await a.db.from('habit_entries').upsert(
    { habit_id: sleep.id, entry_date: today, habit_version: sleep.current_version, field_values: { hours: 30 } },
    { onConflict: 'habit_id,entry_date' })
  check('server validation rejects 30 h sleep', !!tooMuch.error, tooMuch.error?.message)

  // Privacy: nothing visible until shared
  let seen = await b.db.from('habits').select('id').eq('owner_id', a.id)
  check('family cannot see private habits', seen.data?.length === 0)
  await a.db.from('habits').update({ visibility: 'family' }).eq('id', water.id)
  seen = await b.db.from('habits').select('id').eq('owner_id', a.id)
  check('family sees only the shared habit', seen.data?.length === 1 && seen.data[0]!.id === water.id)
  const entries = await b.db.from('habit_entries').select('habit_id').eq('user_id', a.id)
  check('family sees only shared entries', entries.data?.length === 1 && entries.data[0]!.habit_id === water.id)

  const { data: series } = await b.db.rpc('family_metric_series', { p_start: today, p_end: today })
  check('comparison excludes private habits', !!series && series.every((r) => r.habit_id !== sleep.id) && series.some((r) => r.habit_id === water.id))
  const { data: board } = await b.db.rpc('family_leaderboard', { p_start: today, p_end: today })
  const aRow = board?.find((r) => r.user_id === a.id)
  check('leaderboard counts shared habits only', aRow?.shared_habits === 1 && aRow?.completed_days === 1)

  // API bypass attempts
  const hack = await b.db.from('habits').update({ name: 'hacked' }).eq('id', water.id).select('id')
  check('cannot modify another member’s habit', (hack.data?.length ?? 0) === 0)
  const selfAdmin = await b.db.rpc('set_family_member_role', { p_user: b.id, p_role: 'admin' })
  check('member cannot promote self', !!selfAdmin.error)
  const anonRead = await anon.from('habits').select('id').limit(1)
  check('anonymous API reads nothing', !!anonRead.error || (anonRead.data?.length ?? 0) === 0)
  const badge = await b.db.from('user_achievements').insert({ user_id: b.id, achievement_id: crypto.randomUUID() })
  check('cannot award own badge', !!badge.error)

  // Habit builder + versioning
  const { data: hid, error: hErr } = await a.db.rpc('create_habit', {
    p_habit: { name: 'Reading', icon: 'book-open', color: 'sky', notes_enabled: true },
    p_fields: [
      { field_key: 'hours', label: 'Hours read', field_type: 'number', unit: 'h', required: true, options: [], validation: { min: 0 } },
      { field_key: 'book_type', label: 'Type of book', field_type: 'dropdown', options: ['Fiction', 'Non-fiction'], required: false, validation: {} },
    ],
  })
  check('create custom habit', !hErr && !!hid, hErr?.message)
  const { data: v2, error: vErr } = await a.db.rpc('save_habit_fields', {
    p_habit_id: hid!, p_fields: [{ field_key: 'hours', label: 'Hours read', field_type: 'number', unit: 'h', required: true, options: [], validation: { min: 0, max: 24 } }],
  })
  check('edit fields creates version 2', !vErr && v2 === 2, vErr?.message)

  // Cleanup what clients can clean
  await b.db.rpc('leave_family')
  await a.db.rpc('leave_family')
  const { data: famLeft } = await a.db.from('families').select('id')
  check('leaving family (empty family deleted)', famLeft?.length === 0)

  console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILED`}`)
  console.log(`Cleanup (Supabase SQL Editor): delete from auth.users where email like 'smoke\\_%${suffix}@${DOMAIN}';`)
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
