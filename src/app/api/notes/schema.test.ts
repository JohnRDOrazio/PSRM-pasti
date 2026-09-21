import { describe, expect, it } from 'vitest'
import { dietaryNotesSchema, notesBodySchema } from './schema'

describe('dietaryNotesSchema', () => {
  it('trims and turns an empty string into null', () => {
    expect(dietaryNotesSchema.parse('  celiaca ')).toBe('celiaca')
    expect(dietaryNotesSchema.parse('')).toBeNull()
    expect(dietaryNotesSchema.parse('   ')).toBeNull()
    expect(dietaryNotesSchema.parse(undefined)).toBeNull()
  })
  it('rejects more than 500 characters', () => {
    expect(dietaryNotesSchema.safeParse('x'.repeat(500)).success).toBe(true)
    expect(dietaryNotesSchema.safeParse('x'.repeat(501)).success).toBe(false)
  })
})

describe('notesBodySchema', () => {
  it('accepts { dietary_notes } and rejects a missing or non-string field', () => {
    expect(notesBodySchema.parse({ dietary_notes: 'no lattosio' })).toEqual({ dietary_notes: 'no lattosio' })
    expect(notesBodySchema.safeParse({}).success).toBe(false)
    expect(notesBodySchema.safeParse({ dietary_notes: 3 }).success).toBe(false)
  })
})
