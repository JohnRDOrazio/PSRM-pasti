import { describe, expect, it } from 'vitest'
import { groupSchema } from './schema'

describe('groupSchema', () => {
  it('trims the name', () => {
    expect(groupSchema.parse({ name: '  Suore ' })).toEqual({ name: 'Suore' })
  })
  it('rejects an empty or overlong name', () => {
    expect(groupSchema.safeParse({ name: '   ' }).success).toBe(false)
    expect(groupSchema.safeParse({ name: 'x'.repeat(60) }).success).toBe(true)
    expect(groupSchema.safeParse({ name: 'x'.repeat(61) }).success).toBe(false)
  })
})
