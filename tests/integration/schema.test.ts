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

describe('RLS', () => {
  it('is enabled on every table', async () => {
    const rows = await q`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`
    expect(rows.map((r) => r.relname)).toEqual([])
  })
})
