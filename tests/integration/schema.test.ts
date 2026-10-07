import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { q, resetData, rpc, sql } from './helpers'

beforeAll(resetData)
afterAll(() => sql.end())

describe('season_default (seeded: 10-01→06-30 present, 07-01→09-30 absent)', () => {
  it.each([
    ['2026-10-15', 'lunch', true],
    ['2026-01-15', 'dinner', true], // year wrap
    ['2026-06-30', 'lunch', true],
    ['2026-07-01', 'lunch', false],
    ['2026-09-30', 'dinner', false],
    ['2026-10-01', 'lunch', true],
  ])('%s %s → %s', async (date, meal, expected) => {
    expect(await rpc('season_default', { p_date: date, p_meal: meal })).toBe(expected)
  })

  it('one-off rows win over recurring rows, and the narrowest one-off wins', async () => {
    await sql`insert into season_defaults (label, start_date, end_date, lunch_default, dinner_default)
              values ('Novembre', '2026-11-01', '2026-11-30', true, true),
                     ('Ritiro', '2026-11-10', '2026-11-14', false, true)`
    try {
      expect(await rpc('season_default', { p_date: '2026-11-12', p_meal: 'lunch' })).toBe(false)
      expect(await rpc('season_default', { p_date: '2026-11-12', p_meal: 'dinner' })).toBe(true)
      expect(await rpc('season_default', { p_date: '2026-11-15', p_meal: 'lunch' })).toBe(true)
    } finally {
      await sql`delete from season_defaults where start_date is not null`
    }
  })
})

describe('season nesting (seeded: Anno 10-01→06-30, Estate 07-01→09-30)', () => {
  const recurring = (label: string, start: string, end: string, present = false) =>
    sql`insert into season_defaults (label, start_md, end_md, lunch_default, dinner_default) values (${label}, ${start}, ${end}, ${present}, ${present})`
  const oneOff = (label: string, start: string, end: string) =>
    sql`insert into season_defaults (label, start_date, end_date, lunch_default, dinner_default) values (${label}, ${start}, ${end}, false, false)`
  const cleanup = () => sql`delete from season_defaults where label not in ('Anno', 'Estate')`

  it('allows a recurring season nested in another, even across the year end, and the innermost wins', async () => {
    try {
      await recurring('Natale', '12-24', '01-06')
      await recurring('Capodanno', '12-31', '01-01', true)
      expect(await rpc('season_default', { p_date: '2026-12-25', p_meal: 'lunch' })).toBe(false)
      expect(await rpc('season_default', { p_date: '2027-01-01', p_meal: 'lunch' })).toBe(true)
      expect(await rpc('season_default', { p_date: '2027-01-07', p_meal: 'lunch' })).toBe(true)
      expect(await rpc('season_default', { p_date: '2026-12-23', p_meal: 'lunch' })).toBe(true)
    } finally {
      await cleanup()
    }
  })

  it.each([
    ['across two seasons', '06-15', '07-15', 'Anno'],
    ['across the year end', '12-01', '12-31', 'Natale'],
    ['identical dates', '12-24', '01-06', 'Natale'],
    ['the same whole year, written differently', '07-01', '06-30', 'Tutto'],
  ])('rejects a recurring season that partly overlaps: %s', async (_, start, end, conflict) => {
    try {
      await recurring('Natale', '12-24', '01-06')
      if (conflict === 'Tutto') await recurring('Tutto', '01-01', '12-31') // contains Anno and Estate: allowed
      await expect(recurring('X', start, end)).rejects.toMatchObject({ code: '23P01', detail: conflict })
    } finally {
      await cleanup()
    }
  })

  it('checks updates too, but not a season against itself', async () => {
    try {
      await recurring('Natale', '12-24', '01-06')
      await sql`update season_defaults set label = 'Natale!' where label = 'Natale'`
      await expect(sql`update season_defaults set end_md = '07-15' where label = 'Natale!'`)
        .rejects.toMatchObject({ code: '23P01' })
    } finally {
      await cleanup()
    }
  })

  it('applies the same rule among one-off seasons, but not between one-off and recurring', async () => {
    try {
      await oneOff('Novembre', '2026-11-01', '2026-11-30')
      await oneOff('Ritiro', '2026-11-10', '2026-11-14')
      await oneOff('Esercizi', '2026-06-28', '2026-07-03') // straddles Anno/Estate: fine
      await expect(oneOff('Avvento', '2026-11-20', '2026-12-05')).rejects.toMatchObject({ code: '23P01', detail: 'Novembre' })
      await expect(oneOff('Doppio', '2026-11-10', '2026-11-14')).rejects.toMatchObject({ code: '23P01', detail: 'Ritiro' })
    } finally {
      await cleanup()
    }
  })
})

describe('is_locked (settings: 10:00 / 10:00)', () => {
  it.each([
    ['2026-09-13', 'lunch', '2026-09-13T07:59:00Z', false],
    ['2026-09-13', 'lunch', '2026-09-13T08:00:00Z', true], // 10:00 CEST
    ['2026-09-12', 'dinner', '2026-09-13T00:00:00Z', true],
    ['2026-09-14', 'lunch', '2026-09-13T23:00:00Z', false],
    ['2026-01-13', 'dinner', '2026-01-13T09:00:00Z', true], // 10:00 CET
  ])('%s %s at %s → %s', async (date, meal, now, expected) => {
    expect(await rpc('is_locked', { p_date: date, p_meal: meal, p_now: now })).toBe(expected)
  })
})

describe('interval_cells', () => {
  it('expands meal-to-meal', async () => {
    const rows = await rpc<{ date: string; meal: string }[]>('interval_cells', {
      p_start_date: '2026-10-20', p_start_meal: 'dinner', p_end_date: '2026-10-21', p_end_meal: 'lunch',
    })
    expect(rows).toEqual([
      { date: '2026-10-20', meal: 'dinner' },
      { date: '2026-10-21', meal: 'lunch' },
    ])
  })
})

describe('privileges', () => {
  it('does not grant PUBLIC (anon/authenticated) execute on sensitive functions', async () => {
    for (const role of ['anon', 'authenticated']) {
      expect(await q`select has_function_privilege(
          ${role},
          'apply_change(uuid,actor_t,uuid,change_kind_t,date,meal_t,date,meal_t,boolean,timestamptz)',
          'execute'
        )::boolean as allowed`).toEqual([{ allowed: false }])
    }
    expect(await q`select has_function_privilege(
        'anon',
        'effective_presence(uuid,date,date)',
        'execute'
      )::boolean as allowed`).toEqual([{ allowed: false }])
  })
})

describe('RLS', () => {
  it('is enabled on every table', async () => {
    const rows = await q`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`
    expect(rows.map((r) => r.relname)).toEqual([])
  })
})

describe('season_defaults MM-DD validity', () => {
  it.each(['02-31', '04-31', '06-31'])('rejects impossible %s', async (md) => {
    await expect(
      sql`insert into season_defaults (label, start_md, end_md, lunch_default, dinner_default) values ('x', ${md}, '12-31', true, true)`,
    ).rejects.toThrow(/season_defaults_md_valid/)
  })
  it('accepts 02-29 (leap-day boundary)', async () => {
    await sql`insert into season_defaults (label, start_md, end_md, lunch_default, dinner_default) values ('leap', '02-29', '03-01', true, true)`
    await sql`delete from season_defaults where label = 'leap'`
  })
})
