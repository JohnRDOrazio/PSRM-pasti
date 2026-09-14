import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createPerson, q, resetData, rpc, sql } from './helpers'

afterAll(() => sql.end())
beforeEach(resetData)

describe('persons_overview', () => {
  it('exposes last change time and count per person', async () => {
    const a = await createPerson('Anna')
    const b = await createPerson('Bruno')
    await rpc('apply_change', { p_person: a, p_actor: 'member', p_actor_user: null, p_kind: 'toggle',
      p_start_date: '2026-10-20', p_start_meal: 'lunch', p_end_date: '2026-10-20', p_end_meal: 'lunch', p_state: false, p_now: '2026-10-01T06:00:00Z' })
    const rows = await q`select id, full_name, change_count, last_change_at::text from persons_overview order by full_name`
    expect(rows).toEqual([
      { id: a, full_name: 'Anna', change_count: 1, last_change_at: expect.stringContaining('2026-10-01') },
      { id: b, full_name: 'Bruno', change_count: 0, last_change_at: null },
    ])
  })
})
