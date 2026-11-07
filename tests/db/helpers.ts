/**
 * Helpers for database tests. Each call runs in its own transaction with the same role and
 * JWT claims PostgREST would use for a signed-in user, so RLS is exercised exactly as it is
 * for real API requests.
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { inject } from 'vitest'

export type Db = pg.Client

export async function connect(): Promise<Db> {
  const client = new pg.Client({ connectionString: inject('databaseUrl') })
  await client.connect()
  return client
}

/** Run SQL as the superuser (setup only — bypasses RLS). */
export async function admin<T extends pg.QueryResultRow = pg.QueryResultRow>(
  db: Db,
  sql: string,
  params: unknown[] = [],
) {
  return db.query<T>(sql, params)
}

/** Run SQL as a signed-in user (role `authenticated`, auth.uid() = userId). */
export async function asUser<T extends pg.QueryResultRow = pg.QueryResultRow>(
  db: Db,
  userId: string,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return runAs<T>(db, 'authenticated', { sub: userId, role: 'authenticated' }, sql, params)
}

/** Run SQL as an anonymous API client (role `anon`). */
export async function asAnon<T extends pg.QueryResultRow = pg.QueryResultRow>(
  db: Db,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return runAs<T>(db, 'anon', { role: 'anon' }, sql, params)
}

/** Run SQL as the service role (Edge Functions). */
export async function asService<T extends pg.QueryResultRow = pg.QueryResultRow>(
  db: Db,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return runAs<T>(db, 'service_role', { role: 'service_role' }, sql, params)
}

async function runAs<T extends pg.QueryResultRow>(
  db: Db,
  role: 'authenticated' | 'anon' | 'service_role',
  claims: Record<string, string>,
  sql: string,
  params: unknown[],
): Promise<T[]> {
  await db.query('begin')
  try {
    await db.query(`set local role ${role}`)
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)])
    const result = await db.query<T>(sql, params)
    await db.query('commit')
    return result.rows
  } catch (error) {
    await db.query('rollback')
    throw error
  }
}

/** Creates an auth user the same way Supabase sign-up does (fires handle_new_user). */
export async function createUser(db: Db, username?: string, timezone = 'UTC') {
  const id = randomUUID()
  const name = username ?? `u${id.replace(/-/g, '').slice(0, 12)}`
  await admin(
    db,
    `insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`,
    [id, `${name}@users.habitnest.invalid`, JSON.stringify({ username: name, display_name: name, timezone })],
  )
  return { id, username: name }
}

export async function habitByTemplate(db: Db, ownerId: string, template: string) {
  const { rows } = await admin<{ id: string; current_version: number }>(
    db,
    `select id, current_version from public.habits where owner_id = $1 and template_key = $2`,
    [ownerId, template],
  )
  return rows[0]!
}

/** Local "today" for UTC users (tests use UTC unless stated otherwise). */
export function utcToday(offsetDays = 0) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

/** Sets up a family: `adminId` creates it and every other user joins with an invite code. */
export async function makeFamily(db: Db, adminId: string, memberIds: string[], name = 'Nest') {
  const [fam] = await asUser<{ create_family: string }>(db, adminId, `select public.create_family($1)`, [name])
  const [inv] = await asUser<{ code: string }>(db, adminId, `select code from public.create_invitation(10, 7)`)
  for (const member of memberIds) {
    await asUser(db, member, `select public.join_family($1)`, [inv!.code])
  }
  return { familyId: fam!.create_family, code: inv!.code }
}

export async function shareHabit(db: Db, ownerId: string, habitId: string) {
  await asUser(db, ownerId, `update public.habits set visibility = 'family' where id = $1`, [habitId])
}

export async function logEntry(
  db: Db,
  userId: string,
  habitId: string,
  date: string,
  values: Record<string, unknown>,
  notes: string | null = null,
) {
  const [h] = await asUser<{ current_version: number }>(
    db,
    userId,
    `select current_version from public.habits where id = $1`,
    [habitId],
  )
  return asUser(
    db,
    userId,
    `insert into public.habit_entries (habit_id, entry_date, habit_version, field_values, notes)
     values ($1, $2, $3, $4, $5)
     on conflict (habit_id, entry_date) do update
       set field_values = excluded.field_values, notes = excluded.notes, habit_version = excluded.habit_version
     returning *`,
    [habitId, date, h!.current_version, JSON.stringify(values), notes],
  )
}
