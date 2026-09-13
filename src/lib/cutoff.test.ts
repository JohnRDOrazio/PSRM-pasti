import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, firstUnlockedCell, isLocked, parseHm } from './cutoff'

const S = DEFAULT_SETTINGS // 10:00 / 10:00

describe('parseHm', () => {
  it('parses HH:MM to minutes', () => {
    expect(parseHm('10:00')).toBe(600)
    expect(parseHm('9:05')).toBe(545)
    expect(() => parseHm('10')).toThrow()
  })
})

describe('isLocked', () => {
  it('locks past days and unlocks future days regardless of time', () => {
    const now = new Date('2026-09-13T12:00:00Z')
    expect(isLocked({ date: '2026-09-12', meal: 'dinner' }, now, S)).toBe(true)
    expect(isLocked({ date: '2026-09-14', meal: 'lunch' }, now, S)).toBe(false)
  })
  it('locks today at exactly the cutoff, Rome time (CEST)', () => {
    expect(isLocked({ date: '2026-09-13', meal: 'lunch' }, new Date('2026-09-13T07:59:00Z'), S)).toBe(false)
    expect(isLocked({ date: '2026-09-13', meal: 'lunch' }, new Date('2026-09-13T08:00:00Z'), S)).toBe(true)
  })
  it('uses CET in winter', () => {
    expect(isLocked({ date: '2026-01-13', meal: 'dinner' }, new Date('2026-01-13T08:59:00Z'), S)).toBe(false)
    expect(isLocked({ date: '2026-01-13', meal: 'dinner' }, new Date('2026-01-13T09:00:00Z'), S)).toBe(true)
  })
  it('is correct on the DST switch day (2026-03-29, clocks forward at 02:00)', () => {
    expect(isLocked({ date: '2026-03-29', meal: 'lunch' }, new Date('2026-03-29T07:59:00Z'), S)).toBe(false)
    expect(isLocked({ date: '2026-03-29', meal: 'lunch' }, new Date('2026-03-29T08:00:00Z'), S)).toBe(true)
  })
  it('respects per-meal cutoffs', () => {
    const s = { lunch_cutoff: '10:00', dinner_cutoff: '15:00' }
    const now = new Date('2026-09-13T10:00:00Z') // 12:00 Rome
    expect(isLocked({ date: '2026-09-13', meal: 'lunch' }, now, s)).toBe(true)
    expect(isLocked({ date: '2026-09-13', meal: 'dinner' }, now, s)).toBe(false)
  })
})

describe('firstUnlockedCell', () => {
  it('is today lunch before the cutoff', () => {
    expect(firstUnlockedCell(new Date('2026-09-13T06:00:00Z'), S)).toEqual({ date: '2026-09-13', meal: 'lunch' })
  })
  it('is tomorrow lunch after both cutoffs', () => {
    expect(firstUnlockedCell(new Date('2026-09-13T12:00:00Z'), S)).toEqual({ date: '2026-09-14', meal: 'lunch' })
  })
  it('is today dinner between a lunch and a later dinner cutoff', () => {
    const s = { lunch_cutoff: '10:00', dinner_cutoff: '15:00' }
    expect(firstUnlockedCell(new Date('2026-09-13T10:00:00Z'), s)).toEqual({ date: '2026-09-13', meal: 'dinner' })
  })
})
