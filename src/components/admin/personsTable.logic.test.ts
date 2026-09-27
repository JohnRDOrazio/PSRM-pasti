import { describe, expect, it } from 'vitest'
import type { PersonRow } from './PersonsTable'
import { groupSections } from './personsTable.logic'

const person = (id: string, group_id: string | null): PersonRow => ({
  id, full_name: id, group_id, group_name: null, dietary_notes: null, active: true, last_change_at: null, change_count: 0,
})

describe('groupSections', () => {
  const groups = [{ id: 'g1', name: 'Ospiti' }, { id: 'g2', name: 'Seminaristi' }, { id: 'g3', name: 'Vuoto' }]

  it('follows the groups order, keeps row order, puts people without a group last and drops empty groups', () => {
    const rows = [person('a', 'g2'), person('b', null), person('c', 'g1'), person('d', 'g2')]
    expect(groupSections(rows, groups, 'Senza gruppo').map((s) => [s.label, s.rows.map((r) => r.id)])).toEqual([
      ['Ospiti', ['c']],
      ['Seminaristi', ['a', 'd']],
      ['Senza gruppo', ['b']],
    ])
  })

  it('treats an unknown group id as no group', () => {
    expect(groupSections([person('a', 'gone')], groups, 'Senza gruppo')).toEqual([{ key: 'none', label: 'Senza gruppo', rows: [person('a', 'gone')] }])
  })
})
