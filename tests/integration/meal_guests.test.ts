import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { q, resetData, sql } from './helpers'

afterAll(() => sql.end())
beforeEach(resetData)

describe('meal_guests', () => {
  it('keeps guests and Propedeutico apart for the same meal, one row per kind', async () => {
    await sql`insert into meal_guests (date, meal, count) values ('2026-10-20', 'lunch', 3)` // kind defaults to guests
    await sql`insert into meal_guests (date, meal, kind, count) values ('2026-10-20', 'lunch', 'propd', 5)`
    expect(await q`select kind::text, count from meal_guests order by kind`).toEqual([
      { kind: 'guests', count: 3 },
      { kind: 'propd', count: 5 },
    ])
    await expect(sql`insert into meal_guests (date, meal, kind, count) values ('2026-10-20', 'lunch', 'propd', 1)`)
      .rejects.toMatchObject({ code: '23505' })
  })
})
