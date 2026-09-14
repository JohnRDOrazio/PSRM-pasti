import { describe, expect, it } from 'vitest'
import { type RosterRow, summarise } from './kitchen.logic'

const roster: RosterRow[] = [
  { person_id: '1', full_name: 'Anna', group_name: 'Suore', lunch_present: true, lunch_explicit: false, dinner_present: false, dinner_explicit: true },
  { person_id: '2', full_name: 'Bruno', group_name: 'Sacerdoti', lunch_present: false, lunch_explicit: true, dinner_present: true, dinner_explicit: false },
  { person_id: '3', full_name: 'Carla', group_name: null, lunch_present: true, lunch_explicit: false, dinner_present: true, dinner_explicit: false },
]

describe('summarise', () => {
  it('counts present people overall and per group (null group → "Altri")', () => {
    expect(summarise(roster, 'lunch')).toEqual({ total: 2, byGroup: [['Suore', 1], ['Altri', 1]] })
    expect(summarise(roster, 'dinner')).toEqual({ total: 2, byGroup: [['Sacerdoti', 1], ['Altri', 1]] })
  })
})
