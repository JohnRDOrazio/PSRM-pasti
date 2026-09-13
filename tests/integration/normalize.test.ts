import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createPerson, q, resetData, rpc, sql } from './helpers'

afterAll(() => sql.end())
beforeEach(resetData)

describe('normalize_meal_choices', () => {
  it('removes exceptions that now equal the season default and keeps ones that still differ', async () => {
    const p = await createPerson()
    // October-June default present=true; explicit absent on 2026-11-12 lunch is an exception.
    await rpc('apply_change', {
      p_person: p, p_actor: 'member', p_actor_user: null, p_kind: 'toggle',
      p_start_date: '2026-11-12', p_start_meal: 'lunch', p_end_date: '2026-11-12', p_end_meal: 'lunch',
      p_state: false, p_now: '2026-10-01T06:00:00Z',
    })
    expect(await q`select present from meal_choices where person_id = ${p} and date = '2026-11-12' and meal = 'lunch'`)
      .toEqual([{ present: false }])

    const [season] = await sql`
      insert into season_defaults (label, start_date, end_date, lunch_default, dinner_default)
      values ('Ritiro', '2026-11-10', '2026-11-14', false, true)
      returning id`
    try {
      const removed = await rpc<number>('normalize_meal_choices', {})
      expect(removed).toBe(1)
      expect(await q`select present from meal_choices where person_id = ${p} and date = '2026-11-12' and meal = 'lunch'`)
        .toEqual([])

      // A row that still differs from the (new) default must survive normalization.
      await rpc('apply_change', {
        p_person: p, p_actor: 'member', p_actor_user: null, p_kind: 'toggle',
        p_start_date: '2026-11-13', p_start_meal: 'lunch', p_end_date: '2026-11-13', p_end_meal: 'lunch',
        p_state: true, p_now: '2026-10-01T06:00:00Z',
      })
      expect(await q`select present from meal_choices where person_id = ${p} and date = '2026-11-13' and meal = 'lunch'`)
        .toEqual([{ present: true }])
      expect(await rpc<number>('normalize_meal_choices', {})).toBe(0)
      expect(await q`select present from meal_choices where person_id = ${p} and date = '2026-11-13' and meal = 'lunch'`)
        .toEqual([{ present: true }])
    } finally {
      await sql`delete from season_defaults where id = ${season.id}`
    }
  })
})
