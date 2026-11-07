/**
 * Habit data integrity: server-side entry validation, versioned field definitions,
 * completion, streaks (incl. frequency days) and achievements.
 */
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { admin, asUser, connect, createUser, habitByTemplate, logEntry, utcToday, type Db } from './helpers'

let db: Db
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

const readingFields = [
  { field_key: 'hours', label: 'Hours read', field_type: 'number', unit: 'h', required: true, validation: { min: 0, max: 24 } },
  { field_key: 'book_type', label: 'Type of book', field_type: 'dropdown', options: ['Fiction', 'Non-fiction', 'Comics'], required: false },
  { field_key: 'notes', label: 'Notes', field_type: 'text', required: false, validation: { maxLength: 50 } },
]

async function createReading(userId: string, extra: Record<string, unknown> = {}, goal: unknown = null) {
  const [r] = await asUser<{ create_habit: string }>(db, userId, `select public.create_habit($1, $2, $3)`, [
    JSON.stringify({ name: 'Reading', icon: 'book-open', color: 'sky', notes_enabled: true, ...extra }),
    JSON.stringify(readingFields),
    goal === null ? null : JSON.stringify(goal),
  ])
  return r!.create_habit
}

describe('default habits', () => {
  test('defaults have the specified field types, units and decimal support', async () => {
    const u = await createUser(db)
    const { rows } = await admin<{ template_key: string; field_type: string; unit: string | null; validation: { integer?: boolean } }>(db,
      `select h.template_key, d.field_type, d.unit, d.validation
         from public.habits h join public.habit_field_definitions d on d.habit_id = h.id
        where h.owner_id = $1 order by h.sort_order`, [u.id])
    expect(rows.map((r) => [r.template_key, r.field_type, r.unit])).toEqual([
      ['sleep', 'number', 'h'], ['exercise', 'number', 'h'], ['walking', 'number', 'steps'],
      ['junk_food', 'radio', null], ['water', 'number', 'L'],
    ])
    expect(rows[2]!.validation.integer).toBe(true)
    const sleep = await habitByTemplate(db, u.id, 'sleep')
    const [e] = await logEntry(db, u.id, sleep.id, utcToday(), { hours: 7.5 })
    expect(e).toMatchObject({ is_complete: true })
    const junk = await habitByTemplate(db, u.id, 'junk_food')
    const [j] = await logEntry(db, u.id, junk.id, utcToday(), { had_junk_food: 'Yes' }, 'Pizza') as { is_complete: boolean; notes: string }[]
    expect(j).toMatchObject({ is_complete: false, notes: 'Pizza' })
  })
})

describe('entry validation (server-side)', () => {
  let user: { id: string }
  let habit: string
  beforeAll(async () => {
    user = await createUser(db)
    habit = await createReading(user.id)
  })

  test('accepts valid values, drops empty optional ones', async () => {
    const [e] = await logEntry(db, user.id, habit, utcToday(), { hours: 1.25, book_type: 'Fiction', notes: '' })
    expect(e).toMatchObject({ field_values: { hours: 1.25, book_type: 'Fiction' } })
  })

  test.each([
    [{ book_type: 'Fiction' }, /required/],
    [{ hours: 'two' }, /must be a number/],
    [{ hours: 30 }, /at most 24/],
    [{ hours: -1 }, /at least 0/],
    [{ hours: 1, book_type: 'Poetry' }, /valid option/],
    [{ hours: 1, notes: 'x'.repeat(51) }, /too long/],
    [{ hours: 1, surprise: 1 }, /Unknown field/],
  ])('rejects %j', async (values, message) => {
    await expect(logEntry(db, user.id, habit, utcToday(-1), values)).rejects.toThrow(message)
  })

  test('integer validation on steps', async () => {
    const walking = await habitByTemplate(db, user.id, 'walking')
    await expect(logEntry(db, user.id, walking.id, utcToday(), { steps: 100.5 })).rejects.toThrow(/whole number/)
  })

  test('future dates are rejected; duplicates for the same day are upserted, not duplicated', async () => {
    await expect(logEntry(db, user.id, habit, utcToday(2), { hours: 1 })).rejects.toThrow(/future/)
    await logEntry(db, user.id, habit, utcToday(-3), { hours: 1 })
    await logEntry(db, user.id, habit, utcToday(-3), { hours: 2 })
    const rows = await asUser<{ field_values: { hours: number } }>(db, user.id,
      `select field_values from public.habit_entries where habit_id = $1 and entry_date = $2`, [habit, utcToday(-3)])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.field_values.hours).toBe(2)
    await expect(asUser(db, user.id,
      `insert into public.habit_entries (habit_id, entry_date, habit_version, field_values) values ($1, $2, 1, '{"hours": 3}')`,
      [habit, utcToday(-3)])).rejects.toThrow(/duplicate key/)
  })

  test('PostgREST-style upsert (all columns in DO UPDATE) works and cannot move an entry', async () => {
    const water = await habitByTemplate(db, user.id, 'water')
    const upsert = (date: string, litres: number) =>
      asUser(db, user.id,
        `insert into public.habit_entries (habit_id, entry_date, habit_version, field_values, notes)
         values ($1, $2, 1, $3, null)
         on conflict (habit_id, entry_date) do update set habit_id = excluded.habit_id, entry_date = excluded.entry_date,
           habit_version = excluded.habit_version, field_values = excluded.field_values, notes = excluded.notes
         returning field_values`, [water.id, date, JSON.stringify({ litres })])
    await upsert(utcToday(-7), 1)
    const [r] = await upsert(utcToday(-7), 2.5) as { field_values: { litres: number } }[]
    expect(r!.field_values.litres).toBe(2.5)
    await expect(asUser(db, user.id,
      `update public.habit_entries set entry_date = $2 where habit_id = $1 and entry_date = $3`,
      [water.id, utcToday(-8), utcToday(-7)])).rejects.toThrow(/cannot change/)
  })

  test('notes are discarded when the habit has notes disabled', async () => {
    const sleep = await habitByTemplate(db, user.id, 'sleep')
    const [e] = await logEntry(db, user.id, sleep.id, utcToday(-5), { hours: 8 }, 'should vanish') as { notes: string | null }[]
    expect(e!.notes).toBeNull()
  })
})

describe('versioned field definitions', () => {
  test('editing fields creates a new version; old entries keep theirs and stay readable', async () => {
    const u = await createUser(db)
    const habit = await createReading(u.id)
    await logEntry(db, u.id, habit, utcToday(-1), { hours: 2, book_type: 'Comics' })

    // Unchanged fields → same version.
    const [same] = await asUser<{ save_habit_fields: number }>(db, u.id,
      `select public.save_habit_fields($1, $2, null)`, [habit, JSON.stringify(readingFields)])
    expect(same!.save_habit_fields).toBe(1)

    // Change: unit h → min, add a radio field, drop text notes.
    const v2Fields = [
      { ...readingFields[0], label: 'Minutes read', unit: 'min', validation: { min: 0, max: 600, integer: true } },
      readingFields[1],
      { field_key: 'finished', label: 'Finished a book?', field_type: 'radio', options: ['Yes', 'No'], required: false },
    ]
    const [v2] = await asUser<{ save_habit_fields: number }>(db, u.id,
      `select public.save_habit_fields($1, $2, $3)`, [habit, JSON.stringify(v2Fields), JSON.stringify({ field_key: 'hours', operator: 'gte', value: 20 })])
    expect(v2!.save_habit_fields).toBe(2)

    const entries = await asUser<{ habit_version: number; field_values: Record<string, unknown> }>(db, u.id,
      `select habit_version, field_values from public.habit_entries where habit_id = $1`, [habit])
    expect(entries[0]).toMatchObject({ habit_version: 1, field_values: { hours: 2, book_type: 'Comics' } })

    const defs = await asUser<{ version: number; label: string; unit: string | null }>(db, u.id,
      `select version, label, unit from public.habit_field_definitions where habit_id = $1 and field_key = 'hours' order by version`, [habit])
    expect(defs).toEqual([{ version: 1, label: 'Hours read', unit: 'h' }, { version: 2, label: 'Minutes read', unit: 'min' }])

    // New entries must use the new version; the old version can still be edited in place.
    await expect(asUser(db, u.id,
      `insert into public.habit_entries (habit_id, entry_date, habit_version, field_values) values ($1, $2, 1, '{"hours": 1}')`,
      [habit, utcToday()])).rejects.toThrow(/reload/)
    const [n] = await logEntry(db, u.id, habit, utcToday(), { hours: 25, finished: 'Yes' }) as { is_complete: boolean }[]
    expect(n!.is_complete).toBe(true)
    await asUser(db, u.id, `update public.habit_entries set field_values = '{"hours": 3}' where habit_id = $1 and entry_date = $2`, [habit, utcToday(-1)])
  })

  test('goal must reference an existing field and use a compatible operator', async () => {
    const u = await createUser(db)
    await expect(createReading(u.id, {}, { field_key: 'nope', operator: 'gte', value: 1 })).rejects.toThrow(/not part of this habit/)
    await expect(createReading(u.id, {}, { field_key: 'book_type', operator: 'gte', value: 'x' })).rejects.toThrow(/Only number fields/)
  })

  test('field definition input is validated', async () => {
    const u = await createUser(db)
    const bad = async (fields: unknown) =>
      asUser(db, u.id, `select public.create_habit($1, $2, null)`, [JSON.stringify({ name: 'X' }), JSON.stringify(fields)])
    await expect(bad([])).rejects.toThrow(/between 1 and 12/)
    await expect(bad([{ field_key: 'a', label: 'A', field_type: 'radio', options: ['only one'] }])).rejects.toThrow()
    await expect(bad([{ field_key: 'a', label: 'A', field_type: 'number' }, { field_key: 'a', label: 'B', field_type: 'text' }]))
      .rejects.toThrow(/Duplicate field key/)
    await expect(bad([{ field_key: 'Bad Key', label: 'A', field_type: 'text' }])).rejects.toThrow(/Invalid field key/)
  })

  test('new habits default to private', async () => {
    const u = await createUser(db)
    const id = await createReading(u.id)
    const { rows } = await admin(db, `select visibility from public.habits where id = $1`, [id])
    expect(rows[0]!.visibility).toBe('private')
  })
})

describe('streaks and achievements', () => {
  test('streak counts consecutive scheduled days; today pending does not break it', async () => {
    const u = await createUser(db)
    const water = await habitByTemplate(db, u.id, 'water')
    for (const d of [-1, -2, -3]) await logEntry(db, u.id, water.id, utcToday(d), { litres: 2.5 })
    await logEntry(db, u.id, water.id, utcToday(-5), { litres: 3 })
    const [s] = await asUser<{ current_streak: number; best_streak: number }>(db, u.id, `select * from public.habit_streak($1)`, [water.id])
    expect(s).toEqual({ current_streak: 3, best_streak: 3 })

    // An incomplete entry today does not break the streak; a complete one extends it.
    await logEntry(db, u.id, water.id, utcToday(), { litres: 1 })
    const [s2] = await asUser<{ current_streak: number }>(db, u.id, `select * from public.habit_streak($1)`, [water.id])
    expect(s2!.current_streak).toBe(3)
    await logEntry(db, u.id, water.id, utcToday(), { litres: 2 })
    const [s3] = await asUser<{ current_streak: number }>(db, u.id, `select * from public.habit_streak($1)`, [water.id])
    expect(s3!.current_streak).toBe(4)
  })

  test('unscheduled days are skipped by the streak', async () => {
    const u = await createUser(db)
    const sleep = await habitByTemplate(db, u.id, 'sleep')
    const dow = (offset: number) => new Date(`${utcToday(offset)}T00:00:00Z`).getUTCDay()
    // Schedule only today and two days ago → yesterday is not scheduled.
    await asUser(db, u.id, `update public.habits set frequency_days = $2 where id = $1`, [sleep.id, [dow(0), dow(-2)]])
    await logEntry(db, u.id, sleep.id, utcToday(-2), { hours: 8 })
    await logEntry(db, u.id, sleep.id, utcToday(), { hours: 8 })
    const [s] = await asUser<{ current_streak: number }>(db, u.id, `select * from public.habit_streak($1)`, [sleep.id])
    expect(s!.current_streak).toBe(2)
  })

  test('badges are awarded once and never removed when entries are deleted', async () => {
    const u = await createUser(db)
    const water = await habitByTemplate(db, u.id, 'water')
    for (const d of [0, -1, -2]) await logEntry(db, u.id, water.id, utcToday(d), { litres: 3 })
    const codes = async () =>
      (await asUser<{ code: string }>(db, u.id,
        `select a.code from public.user_achievements ua join public.achievements a on a.id = ua.achievement_id where ua.user_id = $1`,
        [u.id])).map((r) => r.code).sort()
    expect(await codes()).toEqual(expect.arrayContaining(['first_entry', 'streak_3']))
    await asUser(db, u.id, `delete from public.habit_entries where user_id = $1`, [u.id])
    expect(await codes()).toEqual(expect.arrayContaining(['first_entry', 'streak_3']))
    const notes = await asUser<{ kind: string }>(db, u.id, `select kind from public.notifications where user_id = $1`, [u.id])
    expect(notes.filter((n) => n.kind === 'badge_earned').length).toBeGreaterThanOrEqual(2)
  })

  test('creating a custom habit awards Habit Designer', async () => {
    const u = await createUser(db)
    await createReading(u.id)
    const rows = await asUser<{ code: string }>(db, u.id,
      `select a.code from public.user_achievements ua join public.achievements a on a.id = ua.achievement_id where ua.user_id = $1`, [u.id])
    expect(rows.map((r) => r.code)).toContain('first_custom_habit')
  })
})
