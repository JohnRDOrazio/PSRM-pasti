import { describe, expect, it } from 'vitest'
import { choiceSchema } from './schema'

describe('choiceSchema', () => {
  it('accepts a valid body', () => {
    const r = choiceSchema.safeParse({ start_date: '2026-10-20', start_meal: 'lunch', end_date: '2026-10-21', end_meal: 'dinner', state: false })
    expect(r.success).toBe(true)
  })
  it('rejects bad dates, meals and missing state', () => {
    expect(choiceSchema.safeParse({ start_date: '2026-02-30', start_meal: 'lunch', end_date: '2026-10-21', end_meal: 'dinner', state: false }).success).toBe(false)
    expect(choiceSchema.safeParse({ start_date: '2026-10-20', start_meal: 'brunch', end_date: '2026-10-21', end_meal: 'dinner', state: false }).success).toBe(false)
    expect(choiceSchema.safeParse({ start_date: '2026-10-20', start_meal: 'lunch', end_date: '2026-10-21', end_meal: 'dinner' }).success).toBe(false)
  })
})
