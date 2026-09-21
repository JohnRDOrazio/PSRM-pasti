import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createPerson, ensureGroup, q, resetData, rpc, sql } from './helpers'

afterAll(() => sql.end())
beforeEach(resetData)

describe('groups', () => {
  it('rejects a second group whose name differs only by case', async () => {
    await ensureGroup('Suore')
    await expect(sql`insert into groups (name) values ('suore')`).rejects.toMatchObject({ code: '23505' })
  })

  it('cannot be deleted while a person belongs to it', async () => {
    const g = await ensureGroup('Suore')
    const p = await createPerson('Anna', 'Suore')
    await expect(sql`delete from groups where id = ${g}`).rejects.toMatchObject({ code: '23503' })
    await sql`update persons set group_id = null where id = ${p}`
    await sql`delete from groups where id = ${g}`
    expect(await q`select count(*)::int as n from groups`).toEqual([{ n: 0 }])
  })

  it('groups_overview counts the people in each group', async () => {
    await ensureGroup('Vuoto')
    await createPerson('Anna', 'Suore')
    await createPerson('Bruno', 'Suore')
    await createPerson('Carla', null)
    const rows = await q`select name, member_count from groups_overview order by lower(name)`
    expect(rows).toEqual([{ name: 'Suore', member_count: 2 }, { name: 'Vuoto', member_count: 0 }])
  })

  it('persons_overview and day_roster expose the group name through the join', async () => {
    const a = await createPerson('Anna', 'Suore')
    const b = await createPerson('Bruno', null)
    const g = (await q<{ group_id: string }>`select group_id from persons where id = ${a}`)[0].group_id
    expect(await q`select id, group_id, group_name from persons_overview order by full_name`).toEqual([
      { id: a, group_id: g, group_name: 'Suore' },
      { id: b, group_id: null, group_name: null },
    ])
    const roster = await rpc<{ person_id: string; group_name: string | null }[]>('day_roster', { p_date: '2026-10-20' })
    expect(roster.map((r) => [r.person_id, r.group_name])).toEqual([[a, 'Suore'], [b, null]])
  })

  it('renaming a group is reflected in the roster', async () => {
    await createPerson('Anna', 'Suore')
    await sql`update groups set name = 'Sorelle' where name = 'Suore'`
    const roster = await rpc<{ group_name: string | null }[]>('day_roster', { p_date: '2026-10-20' })
    expect(roster[0].group_name).toBe('Sorelle')
  })
})
