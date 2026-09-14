import { describe, expect, it } from 'vitest'
import { seasonSchema, toRow } from './schema'

describe('seasonSchema', () => {
  it('accepts a recurring season and maps it to a row', () => {
    const r = seasonSchema.parse({ kind: 'recurring', label: 'Estate', start_md: '07-01', end_md: '09-30', lunch_default: false, dinner_default: false })
    expect(toRow(r)).toEqual({ label: 'Estate', start_md: '07-01', end_md: '09-30', start_date: null, end_date: null, lunch_default: false, dinner_default: false })
  })
  it('accepts a one-off season with ordered dates', () => {
    const r = seasonSchema.parse({ kind: 'one_off', label: 'Ritiro', start_date: '2026-11-10', end_date: '2026-11-14', lunch_default: false, dinner_default: true })
    expect(toRow(r).start_md).toBeNull()
    expect(seasonSchema.safeParse({ kind: 'one_off', label: 'X', start_date: '2026-11-14', end_date: '2026-11-10', lunch_default: true, dinner_default: true }).success).toBe(false)
  })
  it('rejects malformed MM-DD', () => {
    expect(seasonSchema.safeParse({ kind: 'recurring', label: 'X', start_md: '13-01', end_md: '09-30', lunch_default: true, dinner_default: true }).success).toBe(false)
  })
})

describe('isValidMd', () => {
  it('rejects impossible month-days and accepts 02-29', () => {
    expect(seasonSchema.safeParse({ kind: 'recurring', label: 'X', start_md: '02-31', end_md: '03-01', lunch_default: true, dinner_default: true }).success).toBe(false)
    expect(seasonSchema.safeParse({ kind: 'recurring', label: 'X', start_md: '04-31', end_md: '05-01', lunch_default: true, dinner_default: true }).success).toBe(false)
    expect(seasonSchema.safeParse({ kind: 'recurring', label: 'X', start_md: '02-29', end_md: '03-01', lunch_default: true, dinner_default: true }).success).toBe(true)
  })
})
