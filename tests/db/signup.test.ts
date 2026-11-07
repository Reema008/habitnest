import { afterAll, beforeAll, expect, test } from 'vitest'
import { admin, connect, createUser, type Db } from './helpers'

let db: Db
beforeAll(async () => { db = await connect() })
afterAll(async () => { await db.end() })

test('sign-up creates profile, settings and 5 private default habits', async () => {
  const u = await createUser(db)
  const { rows } = await admin(db,
    `select (select count(*) from public.habits where owner_id = $1)::int as habits,
            (select count(*) from public.habits where owner_id = $1 and visibility = 'private')::int as private_habits,
            (select count(*) from public.user_settings where user_id = $1)::int as settings,
            (select username from public.profiles where id = $1) as username`, [u.id])
  expect(rows[0]).toEqual({ habits: 5, private_habits: 5, settings: 1, username: u.username })
})
