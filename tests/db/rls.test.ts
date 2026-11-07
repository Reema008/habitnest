/**
 * Row Level Security & privacy tests. These must pass before any family comparison
 * feature ships. Users:
 *   alice (admin) + bob  -> Family A
 *   carol (admin)        -> Family B
 *   dave                 -> no family
 */
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import {
  admin, asAnon, asService, asUser, connect, createUser, habitByTemplate, logEntry, makeFamily,
  shareHabit, utcToday, type Db,
} from './helpers'

let db: Db
let alice: { id: string }, bob: { id: string }, carol: { id: string }, dave: { id: string }
let aliceSleep: string // private
let aliceWater: string // shared
let bobWalking: string // shared
let carolWater: string // shared within Family B
let familyA: string, familyB: string
const today = utcToday()
const yesterday = utcToday(-1)

beforeAll(async () => {
  db = await connect()
  alice = await createUser(db)
  bob = await createUser(db)
  carol = await createUser(db)
  dave = await createUser(db)

  familyA = (await makeFamily(db, alice.id, [bob.id], 'Family A')).familyId
  familyB = (await makeFamily(db, carol.id, [], 'Family B')).familyId

  aliceSleep = (await habitByTemplate(db, alice.id, 'sleep')).id
  aliceWater = (await habitByTemplate(db, alice.id, 'water')).id
  bobWalking = (await habitByTemplate(db, bob.id, 'walking')).id
  carolWater = (await habitByTemplate(db, carol.id, 'water')).id

  await shareHabit(db, alice.id, aliceWater)
  await shareHabit(db, bob.id, bobWalking)
  await shareHabit(db, carol.id, carolWater)

  // Alice: private sleep with secret notes field disabled (sleep), shared water.
  await logEntry(db, alice.id, aliceSleep, today, { hours: 4 })
  await logEntry(db, alice.id, aliceSleep, yesterday, { hours: 8 })
  await logEntry(db, alice.id, aliceWater, today, { litres: 2.5 })
  await logEntry(db, bob.id, bobWalking, today, { steps: 9000 })
  await logEntry(db, carol.id, carolWater, today, { litres: 3 })
})

afterAll(async () => {
  await db.end()
})

describe('1. User A cannot access User B private habits', () => {
  test('bob cannot see alice private habit, its fields or entries', async () => {
    expect(await asUser(db, bob.id, `select id from public.habits where id = $1`, [aliceSleep])).toHaveLength(0)
    expect(await asUser(db, bob.id, `select id from public.habit_field_definitions where habit_id = $1`, [aliceSleep])).toHaveLength(0)
    expect(await asUser(db, bob.id, `select id from public.habit_entries where habit_id = $1`, [aliceSleep])).toHaveLength(0)
  })

  test('bob sees only alice shared habits when listing all her habits', async () => {
    const rows = await asUser<{ id: string }>(db, bob.id, `select id from public.habits where owner_id = $1`, [alice.id])
    expect(rows.map((r) => r.id)).toEqual([aliceWater])
  })

  test('private habit entries are invisible even when queried by user_id', async () => {
    const rows = await asUser<{ habit_id: string }>(db, bob.id, `select habit_id from public.habit_entries where user_id = $1`, [alice.id])
    expect(rows.every((r) => r.habit_id === aliceWater)).toBe(true)
    expect(rows).toHaveLength(1)
  })

  test('can_view_habit helper agrees', async () => {
    const [r] = await asUser<{ a: boolean; b: boolean }>(db, bob.id,
      `select public.can_view_habit($1) a, public.can_view_habit($2) b`, [aliceSleep, aliceWater])
    expect(r).toEqual({ a: false, b: true })
  })
})

describe('2. User A can access User B shared habits within the same family', () => {
  test('bob sees alice shared habit, definitions and entries', async () => {
    expect(await asUser(db, bob.id, `select id from public.habits where id = $1`, [aliceWater])).toHaveLength(1)
    expect(await asUser(db, bob.id, `select id from public.habit_field_definitions where habit_id = $1`, [aliceWater])).toHaveLength(1)
    const entries = await asUser<{ field_values: { litres: number } }>(db, bob.id,
      `select field_values from public.habit_entries where habit_id = $1`, [aliceWater])
    expect(entries[0]!.field_values.litres).toBe(2.5)
  })

  test('shared habit becomes invisible again when set back to private', async () => {
    const bobSleep = (await habitByTemplate(db, bob.id, 'sleep')).id
    await shareHabit(db, bob.id, bobSleep)
    expect(await asUser(db, alice.id, `select id from public.habits where id = $1`, [bobSleep])).toHaveLength(1)
    await asUser(db, bob.id, `update public.habits set visibility = 'private' where id = $1`, [bobSleep])
    expect(await asUser(db, alice.id, `select id from public.habits where id = $1`, [bobSleep])).toHaveLength(0)
  })

  test('sharing one habit does not share any other habit', async () => {
    const rows = await asUser<{ id: string }>(db, alice.id, `select id from public.habits where owner_id = $1`, [bob.id])
    expect(rows.map((r) => r.id)).toEqual([bobWalking])
  })
})

describe('3. User A cannot modify User B records', () => {
  test('bob cannot update or delete alice habits (even shared ones)', async () => {
    const upd = await asUser(db, bob.id, `update public.habits set name = 'hacked' where id = $1 returning id`, [aliceWater])
    expect(upd).toHaveLength(0)
    const del = await asUser(db, bob.id, `delete from public.habits where id = $1 returning id`, [aliceWater])
    expect(del).toHaveLength(0)
    const { rows } = await admin(db, `select name from public.habits where id = $1`, [aliceWater])
    expect(rows[0]!.name).toBe('Water')
  })

  test('bob cannot update or delete alice entries', async () => {
    const upd = await asUser(db, bob.id,
      `update public.habit_entries set notes = 'x' where habit_id = $1 returning id`, [aliceWater])
    expect(upd).toHaveLength(0)
    const del = await asUser(db, bob.id, `delete from public.habit_entries where habit_id = $1 returning id`, [aliceWater])
    expect(del).toHaveLength(0)
  })

  test('bob cannot insert entries into alice habit', async () => {
    await expect(asUser(db, bob.id,
      `insert into public.habit_entries (habit_id, entry_date, habit_version, field_values)
       values ($1, $2, 1, '{"litres": 1}')`, [aliceWater, yesterday])).rejects.toThrow()
  })

  test('bob cannot insert an entry pretending to be alice', async () => {
    await expect(asUser(db, bob.id,
      `insert into public.habit_entries (habit_id, user_id, entry_date, habit_version, field_values)
       values ($1, $2, $3, 1, '{"litres": 1}')`, [aliceWater, alice.id, yesterday])).rejects.toThrow()
  })

  test('bob cannot edit alice profile; nobody can change ownership columns', async () => {
    const upd = await asUser(db, bob.id, `update public.profiles set display_name = 'x' where id = $1 returning id`, [alice.id])
    expect(upd).toHaveLength(0)
    await expect(asUser(db, alice.id, `update public.habits set owner_id = $1 where id = $2`, [bob.id, aliceWater]))
      .rejects.toThrow(/permission denied/)
    await expect(asUser(db, alice.id, `update public.profiles set must_change_password = true where id = $1`, [alice.id]))
      .rejects.toThrow(/permission denied/)
    await expect(asUser(db, alice.id, `update public.habit_entries set is_complete = true where habit_id = $1`, [aliceSleep]))
      .rejects.toThrow(/permission denied/)
  })

  test('bob cannot read alice settings or schedules', async () => {
    await asUser(db, alice.id,
      `insert into public.schedules (day_of_week, title, start_time, end_time) values (1, 'Gym', '07:00', '08:00')`)
    expect(await asUser(db, bob.id, `select * from public.schedules where user_id = $1`, [alice.id])).toHaveLength(0)
    expect(await asUser(db, bob.id, `select * from public.user_settings where user_id = $1`, [alice.id])).toHaveLength(0)
    await expect(asUser(db, bob.id,
      `insert into public.schedules (user_id, day_of_week, title, start_time, end_time) values ($1, 1, 'x', '07:00', '08:00')`,
      [alice.id])).rejects.toThrow()
  })

  test('users cannot award themselves badges', async () => {
    await expect(asUser(db, bob.id,
      `insert into public.user_achievements (user_id, achievement_id) select $1, id from public.achievements limit 1`,
      [bob.id])).rejects.toThrow(/permission denied/)
    await expect(asUser(db, bob.id, `delete from public.user_achievements where user_id = $1`, [bob.id]))
      .rejects.toThrow(/permission denied/)
  })
})

describe('4. Family A members cannot access Family B information', () => {
  test('carol cannot see Family A, its members, profiles, habits or entries', async () => {
    expect(await asUser(db, carol.id, `select id from public.families where id = $1`, [familyA])).toHaveLength(0)
    expect(await asUser(db, carol.id, `select id from public.family_members where family_id = $1`, [familyA])).toHaveLength(0)
    expect(await asUser(db, carol.id, `select id from public.profiles where id in ($1, $2)`, [alice.id, bob.id])).toHaveLength(0)
    expect(await asUser(db, carol.id, `select id from public.habits where id = $1`, [aliceWater])).toHaveLength(0)
    expect(await asUser(db, carol.id, `select id from public.habit_entries where habit_id = $1`, [aliceWater])).toHaveLength(0)
  })

  test('alice cannot see Family B or carol shared habit', async () => {
    expect(await asUser(db, alice.id, `select id from public.families where id = $1`, [familyB])).toHaveLength(0)
    expect(await asUser(db, alice.id, `select id from public.habits where id = $1`, [carolWater])).toHaveLength(0)
  })

  test('alice cannot create challenges in or update Family B', async () => {
    await expect(asUser(db, alice.id,
      `insert into public.family_challenges (family_id, created_by, title, metric_label, unit, aggregation, target, start_date, end_date)
       values ($1, $2, 'x', 'Water', 'L', 'sum', 10, $3, $3)`, [familyB, alice.id, today])).rejects.toThrow()
    const upd = await asUser(db, alice.id, `update public.families set name = 'x' where id = $1 returning id`, [familyB])
    expect(upd).toHaveLength(0)
  })

  test('a user with no family sees no family data and no other profiles', async () => {
    expect(await asUser(db, dave.id, `select id from public.families`)).toHaveLength(0)
    expect(await asUser(db, dave.id, `select id from public.family_members`)).toHaveLength(0)
    const profiles = await asUser<{ id: string }>(db, dave.id, `select id from public.profiles`)
    expect(profiles.map((p) => p.id)).toEqual([dave.id])
    expect(await asUser(db, dave.id, `select * from public.family_leaderboard($1, $2)`, [yesterday, today])).toHaveLength(0)
  })
})

describe('5 & 6. Private habits are excluded from comparisons and leaderboards', () => {
  test('family_metric_series contains only shared habits, for everyone (including the owner)', async () => {
    for (const viewer of [alice.id, bob.id]) {
      const rows = await asUser<{ habit_id: string }>(db, viewer,
        `select habit_id from public.family_metric_series($1, $2)`, [yesterday, today])
      const ids = new Set(rows.map((r) => r.habit_id))
      expect(ids.has(aliceSleep)).toBe(false)
      expect(ids.has(aliceWater)).toBe(true)
      expect(ids.has(bobWalking)).toBe(true)
      expect(ids.has(carolWater)).toBe(false)
    }
  })

  test('leaderboard counts only shared habits (private completions do not change rank)', async () => {
    const before = await asUser<{ user_id: string; shared_habits: number; completed_days: number }>(db, bob.id,
      `select user_id, shared_habits, completed_days from public.family_leaderboard($1, $2)`, [yesterday, today])
    const aliceRow = before.find((r) => r.user_id === alice.id)!
    expect(aliceRow.shared_habits).toBe(1)
    expect(aliceRow.completed_days).toBe(1) // water today; private sleep (yesterday complete) excluded

    // A new private completion must not affect the leaderboard.
    const aliceExercise = (await habitByTemplate(db, alice.id, 'exercise')).id
    await logEntry(db, alice.id, aliceExercise, today, { hours: 1 })
    const after = await asUser<{ user_id: string; completed_days: number; scheduled_days: number }>(db, alice.id,
      `select user_id, completed_days, scheduled_days from public.family_leaderboard($1, $2)`, [yesterday, today])
    const a2 = after.find((r) => r.user_id === alice.id)!
    expect(a2.completed_days).toBe(1)
    expect(after.map((r) => r.user_id).sort()).toEqual([alice.id, bob.id].sort())
  })

  test('badges earned on private habits are hidden from family', async () => {
    const bobDrinkHabit = (await habitByTemplate(db, bob.id, 'water')).id // private
    for (let i = 0; i < 3; i++) await logEntry(db, bob.id, bobDrinkHabit, utcToday(-i), { litres: 3 })
    const own = await asUser<{ code: string }>(db, bob.id,
      `select a.code from public.user_achievements ua join public.achievements a on a.id = ua.achievement_id where ua.user_id = $1`, [bob.id])
    expect(own.map((r) => r.code)).toContain('streak_3')
    const seenByAlice = await asUser<{ code: string }>(db, alice.id,
      `select a.code from public.user_achievements ua join public.achievements a on a.id = ua.achievement_id where ua.user_id = $1`, [bob.id])
    expect(seenByAlice.map((r) => r.code)).not.toContain('streak_3')
    expect(seenByAlice.map((r) => r.code)).toContain('joined_family')
  })
})

describe('Challenges respect privacy', () => {
  test('cannot join a challenge with a private habit', async () => {
    const [c] = await asUser<{ id: string }>(db, alice.id,
      `insert into public.family_challenges (family_id, title, metric_label, unit, aggregation, target, start_date, end_date)
       values ($1, 'Hydrate', 'Water', 'L', 'sum', 20, $2, $3) returning id`, [familyA, yesterday, today])
    await expect(asUser(db, alice.id,
      `insert into public.challenge_participants (challenge_id, habit_id, field_key) values ($1, $2, 'hours')`,
      [c!.id, aliceSleep])).rejects.toThrow(/Share this habit/)
    await asUser(db, alice.id,
      `insert into public.challenge_participants (challenge_id, habit_id, field_key) values ($1, $2, 'litres')`,
      [c!.id, aliceWater])
    const progress = await asUser<{ user_id: string; progress: string }>(db, bob.id,
      `select user_id, progress from public.challenge_progress($1)`, [c!.id])
    expect(Number(progress[0]!.progress)).toBe(2.5)

    // Making the habit private removes it from the challenge entirely.
    await asUser(db, alice.id, `update public.habits set visibility = 'private' where id = $1`, [aliceWater])
    expect(await asUser(db, bob.id, `select * from public.challenge_progress($1)`, [c!.id])).toHaveLength(0)
    await shareHabit(db, alice.id, aliceWater)
  })

  test('cannot join another user into a challenge or use their habit', async () => {
    const [c] = await asUser<{ id: string }>(db, alice.id,
      `insert into public.family_challenges (family_id, title, metric_label, unit, aggregation, target, start_date, end_date)
       values ($1, 'Walk', 'Steps', 'steps', 'sum', 50000, $2, $3) returning id`, [familyA, yesterday, today])
    await expect(asUser(db, alice.id,
      `insert into public.challenge_participants (challenge_id, user_id, habit_id, field_key) values ($1, $2, $3, 'steps')`,
      [c!.id, bob.id, bobWalking])).rejects.toThrow()
    await expect(asUser(db, alice.id,
      `insert into public.challenge_participants (challenge_id, habit_id, field_key) values ($1, $2, 'steps')`,
      [c!.id, bobWalking])).rejects.toThrow()
  })

  test('clients cannot forge the challenge creator', async () => {
    await expect(asUser(db, bob.id,
      `insert into public.family_challenges (family_id, created_by, title, metric_label, aggregation, target, start_date, end_date)
       values ($1, $2, 'x', 'Days', 'days_met', 5, $3, $3)`, [familyA, alice.id, today])).rejects.toThrow(/permission denied/)
  })

  test('outsiders cannot read challenge progress', async () => {
    const [c] = await asUser<{ id: string }>(db, bob.id,
      `insert into public.family_challenges (family_id, title, metric_label, aggregation, target, start_date, end_date)
       values ($1, 'Days', 'Days', 'days_met', 5, $2, $3) returning id`, [familyA, yesterday, today])
    await asUser(db, bob.id, `insert into public.challenge_participants (challenge_id, habit_id) values ($1, $2)`, [c!.id, bobWalking])
    expect(await asUser(db, carol.id, `select * from public.challenge_progress($1)`, [c!.id])).toHaveLength(0)
    expect(await asUser(db, carol.id, `select * from public.challenge_participants where challenge_id = $1`, [c!.id])).toHaveLength(0)
  })
})

describe('7. Unauthorized users cannot access family reports', () => {
  test('anon cannot read any table or call report functions', async () => {
    await expect(asAnon(db, `select * from public.habits`)).rejects.toThrow(/permission denied/)
    await expect(asAnon(db, `select * from public.habit_entries`)).rejects.toThrow(/permission denied/)
    await expect(asAnon(db, `select * from public.profiles`)).rejects.toThrow(/permission denied/)
    await expect(asAnon(db, `select * from public.family_leaderboard($1, $2)`, [yesterday, today]))
      .rejects.toThrow(/permission denied/)
    await expect(asAnon(db, `select * from public.family_metric_series($1, $2)`, [yesterday, today]))
      .rejects.toThrow(/permission denied/)
    await expect(asAnon(db, `select public.join_family('AAAAAAAAAA')`)).rejects.toThrow(/permission denied/)
  })

  test('anon may only check username availability', async () => {
    const [r] = await asAnon<{ ok: boolean }>(db, `select public.username_available('brand_new_name') ok`)
    expect(r!.ok).toBe(true)
  })

  test('carol (other family) gets nothing from Family A reports', async () => {
    const rows = await asUser<{ user_id: string }>(db, carol.id,
      `select user_id from public.family_metric_series($1, $2)`, [yesterday, today])
    expect(rows.every((r) => r.user_id === carol.id)).toBe(true)
    const board = await asUser<{ user_id: string }>(db, carol.id,
      `select user_id from public.family_leaderboard($1, $2)`, [yesterday, today])
    expect(board.map((r) => r.user_id)).toEqual([carol.id])
  })

  test('server-only tables and functions are closed to clients', async () => {
    await expect(asUser(db, alice.id, `select * from public.reminder_deliveries`)).rejects.toThrow(/permission denied/)
    await expect(asUser(db, alice.id, `select * from public.family_join_attempts`)).rejects.toThrow(/permission denied/)
    await expect(asUser(db, alice.id, `select * from public.claim_due_reminders()`)).rejects.toThrow(/permission denied/)
    await expect(asUser(db, alice.id, `select * from public.get_reminder_secrets()`)).rejects.toThrow(/permission denied/)
    await expect(asUser(db, alice.id, `select public._award($1, 'streak_30')`, [alice.id])).rejects.toThrow(/permission denied/)
    await expect(asUser(db, alice.id, `select public.evaluate_achievements($1, null)`, [alice.id])).rejects.toThrow(/permission denied/)
    await expect(asUser(db, alice.id, `select public._create_default_habits($1)`, [bob.id])).rejects.toThrow(/permission denied/)
    await expect(asUser(db, alice.id, `select public.user_local_date($1)`, [bob.id])).rejects.toThrow(/permission denied/)
    // The service role (Edge Functions) can use them.
    await expect(asService(db, `select * from public.claim_due_reminders()`)).resolves.toBeDefined()
  })
})

describe('8. API requests cannot bypass frontend privacy restrictions', () => {
  test('notes on private habits are never returned to family, even via joins', async () => {
    const aliceJunk = (await habitByTemplate(db, alice.id, 'junk_food')).id // notes enabled, private
    await logEntry(db, alice.id, aliceJunk, today, { had_junk_food: 'Yes' }, 'secret donut')
    const rows = await asUser<{ notes: string | null }>(db, bob.id,
      `select e.notes from public.habit_entries e join public.habits h on h.id = e.habit_id where e.notes is not null`)
    expect(rows.map((r) => r.notes)).not.toContain('secret donut')
    const own = await asUser<{ notes: string }>(db, alice.id,
      `select notes from public.habit_entries where habit_id = $1`, [aliceJunk])
    expect(own[0]!.notes).toBe('secret donut')
  })

  test('direct SECURITY DEFINER helpers reveal nothing about other families', async () => {
    const [r] = await asUser<{ s: boolean; v: boolean }>(db, carol.id,
      `select public.shares_family_with($1) s, public.can_view_habit($2) v`, [alice.id, aliceWater])
    expect(r).toEqual({ s: false, v: false })
  })

  test('a user cannot add themselves to a family without an invitation', async () => {
    await expect(asUser(db, dave.id,
      `insert into public.family_members (family_id, user_id, role) values ($1, $2, 'admin')`, [familyA, dave.id]))
      .rejects.toThrow(/permission denied/)
    await expect(asUser(db, dave.id, `insert into public.families (name) values ('x')`)).rejects.toThrow(/permission denied/)
  })

  test('a member cannot promote themselves to admin', async () => {
    const rows = await asUser(db, bob.id,
      `update public.family_members set role = 'admin' where user_id = $1 returning id`, [bob.id])
    expect(rows).toHaveLength(0)
    await expect(asUser(db, bob.id, `select public.set_family_member_role($1, 'admin')`, [bob.id])).rejects.toThrow(/admins/)
  })

  test('members cannot read invitation codes', async () => {
    expect(await asUser(db, bob.id, `select code from public.family_invitations`)).toHaveLength(0)
    await expect(asUser(db, bob.id, `select * from public.create_invitation(5, 7)`)).rejects.toThrow(/admins/)
  })

  test('storage: users can only write their own avatar folder', async () => {
    await asUser(db, alice.id,
      `insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${alice.id}/avatar.png`])
    await expect(asUser(db, alice.id,
      `insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${bob.id}/avatar.png`])).rejects.toThrow()
    const del = await asUser(db, bob.id,
      `delete from storage.objects where name = $1 returning id`, [`${alice.id}/avatar.png`])
    expect(del).toHaveLength(0)
  })
})

describe('Invitations and membership rules', () => {
  test('expired, revoked and used-up codes are rejected; failures are rate-limited', async () => {
    const eve = await createUser(db)
    const [inv] = await asUser<{ id: string; code: string }>(db, carol.id, `select id, code from public.create_invitation(1, 1)`)
    await admin(db, `update public.family_invitations set expires_at = now() - interval '1 minute' where id = $1`, [inv!.id])
    const [r1] = await asUser<{ join_family: string | null }>(db, eve.id, `select public.join_family($1)`, [inv!.code])
    expect(r1!.join_family).toBeNull()

    const [inv2] = await asUser<{ id: string; code: string }>(db, carol.id, `select id, code from public.create_invitation(1, 1)`)
    await asUser(db, carol.id, `update public.family_invitations set revoked_at = now() where id = $1`, [inv2!.id])
    const [r2] = await asUser<{ join_family: string | null }>(db, eve.id, `select public.join_family($1)`, [inv2!.code])
    expect(r2!.join_family).toBeNull()

    const [inv3] = await asUser<{ code: string }>(db, carol.id, `select code from public.create_invitation(1, 1)`)
    const frank = await createUser(db)
    const [r3] = await asUser<{ join_family: string | null }>(db, frank.id, `select public.join_family($1)`, [inv3!.code])
    expect(r3!.join_family).toBe(familyB)
    const [r4] = await asUser<{ join_family: string | null }>(db, eve.id, `select public.join_family($1)`, [inv3!.code])
    expect(r4!.join_family).toBeNull() // max uses reached

    // eve has 3 failures so far; 7 more reaches the limit of 10 per hour.
    for (let i = 0; i < 7; i++) await asUser(db, eve.id, `select public.join_family('ZZZZZZZZZZ')`)
    await expect(asUser(db, eve.id, `select public.join_family($1)`, [inv3!.code])).rejects.toThrow(/Too many attempts/)
  })

  test('cannot join a second family', async () => {
    const [inv] = await asUser<{ code: string }>(db, carol.id, `select code from public.create_invitation(5, 7)`)
    await expect(asUser(db, bob.id, `select public.join_family($1)`, [inv!.code])).rejects.toThrow(/already in a family/)
    await expect(asUser(db, bob.id, `select public.create_family('Another')`)).rejects.toThrow(/already in a family/)
  })

  test('non-admins cannot remove members; admins can; last admin is protected', async () => {
    const g = await createUser(db)
    const h = await createUser(db)
    await makeFamily(db, g.id, [h.id], 'Family G')
    const removed = await asUser(db, h.id, `delete from public.family_members where user_id = $1 returning id`, [g.id])
    expect(removed).toHaveLength(0)
    await expect(asUser(db, h.id, `select public.remove_family_member($1)`, [g.id])).rejects.toThrow(/admins/)
    await expect(asUser(db, g.id, `select public.leave_family()`)).rejects.toThrow(/another member an admin/)
    await asUser(db, g.id, `select public.remove_family_member($1)`, [h.id])
    expect(await asUser(db, h.id, `select id from public.family_members`)).toHaveLength(0)
    await asUser(db, g.id, `select public.leave_family()`)
    const { rows } = await admin(db, `select count(*)::int n from public.families where name = 'Family G'`)
    expect(rows[0]!.n).toBe(0)
  })

  test('leaving a family immediately hides shared data both ways', async () => {
    const x = await createUser(db)
    const y = await createUser(db)
    await makeFamily(db, x.id, [y.id], 'Family X')
    const yWater = (await habitByTemplate(db, y.id, 'water')).id
    await shareHabit(db, y.id, yWater)
    expect(await asUser(db, x.id, `select id from public.habits where id = $1`, [yWater])).toHaveLength(1)
    await asUser(db, y.id, `select public.leave_family()`)
    expect(await asUser(db, x.id, `select id from public.habits where id = $1`, [yWater])).toHaveLength(0)
    expect(await asUser(db, x.id, `select id from public.profiles where id = $1`, [y.id])).toHaveLength(0)
  })
})
