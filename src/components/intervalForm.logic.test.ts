import { describe, expect, it } from 'vitest'
import { validateInterval } from './intervalForm.logic'

const min = { date: '2026-10-20', meal: 'dinner' as const }

describe('validateInterval', () => {
  it('returns cells for a valid interval at or after the minimum cell', () => {
    const r = validateInterval({ startDate: '2026-10-20', startMeal: 'dinner', endDate: '2026-10-21', endMeal: 'lunch' }, min)
    expect(r.error).toBeNull()
    expect(r.cells).toHaveLength(2)
  })
  it('flags a start before the minimum cell', () => {
    const r = validateInterval({ startDate: '2026-10-20', startMeal: 'lunch', endDate: '2026-10-21', endMeal: 'lunch' }, min)
    expect(r.error).toBe('start_too_early')
    expect(r.cells).toEqual([])
  })
  it('flags inverted intervals', () => {
    const r = validateInterval({ startDate: '2026-10-22', startMeal: 'lunch', endDate: '2026-10-21', endMeal: 'lunch' }, min)
    expect(r.error).toBe('invalid_interval')
  })
})
