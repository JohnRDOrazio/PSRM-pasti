import { describe, expect, it } from 'vitest'
import { generateToken, hashToken, isTokenShape, personLink } from './token'

describe('token', () => {
  it('generates 43-char base64url tokens that are unique', () => {
    const a = generateToken()
    const b = generateToken()
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(a).not.toBe(b)
    expect(isTokenShape(a)).toBe(true)
    expect(isTokenShape('short')).toBe(false)
  })
  it('hashes deterministically with sha256 hex', () => {
    expect(hashToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
  it('builds the personal link without double slashes', () => {
    expect(personLink('https://pasti.example.org/', 'tok')).toBe('https://pasti.example.org/p/tok')
    expect(personLink('http://localhost:3000', 'tok')).toBe('http://localhost:3000/p/tok')
  })
})
