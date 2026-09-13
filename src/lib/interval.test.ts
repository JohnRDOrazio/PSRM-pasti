import { describe, expect, it } from 'vitest'
import { IntervalError, expandInterval } from './interval'

describe('expandInterval', () => {
  it('returns a single cell for a same-cell interval', () => {
    expect(expandInterval('2026-10-20', 'lunch', '2026-10-20', 'lunch')).toEqual([{ date: '2026-10-20', meal: 'lunch' }])
  })
  it('includes every meal between the boundaries, respecting partial boundary days', () => {
    expect(expandInterval('2026-10-20', 'dinner', '2026-10-22', 'lunch')).toEqual([
      { date: '2026-10-20', meal: 'dinner' },
      { date: '2026-10-21', meal: 'lunch' },
      { date: '2026-10-21', meal: 'dinner' },
      { date: '2026-10-22', meal: 'lunch' },
    ])
  })
  it('rejects an end before the start', () => {
    expect(() => expandInterval('2026-10-20', 'dinner', '2026-10-20', 'lunch')).toThrow(IntervalError)
    try {
      expandInterval('2026-10-21', 'lunch', '2026-10-20', 'dinner')
    } catch (e) {
      expect((e as IntervalError).code).toBe('invalid_interval')
    }
  })
  it('rejects intervals longer than MAX_CELLS', () => {
    try {
      expandInterval('2026-01-01', 'lunch', '2027-12-31', 'dinner')
      throw new Error('did not throw')
    } catch (e) {
      expect((e as IntervalError).code).toBe('too_long')
    }
  })
})
