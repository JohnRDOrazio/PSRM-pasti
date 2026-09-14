import { describe, expect, it } from 'vitest'
import { addDays, cellFromKey, cellKey, compareCells, dayNumber, isIsoDate, romeParts } from './dates'

describe('isIsoDate', () => {
  it('accepts real dates', () => {
    expect(isIsoDate('2026-09-13')).toBe(true)
    expect(isIsoDate('2028-02-29')).toBe(true)
  })
  it('rejects malformed or impossible dates', () => {
    expect(isIsoDate('2026-9-13')).toBe(false)
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('2026-13-01')).toBe(false)
    expect(isIsoDate('hello')).toBe(false)
  })
})

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-09-13', 29)).toBe('2026-10-12')
  })
})

describe('cell keys', () => {
  it('orders lunch before dinner and days chronologically', () => {
    expect(compareCells({ date: '2026-09-13', meal: 'lunch' }, { date: '2026-09-13', meal: 'dinner' })).toBeLessThan(0)
    expect(compareCells({ date: '2026-09-13', meal: 'dinner' }, { date: '2026-09-14', meal: 'lunch' })).toBeLessThan(0)
    expect(compareCells({ date: '2026-09-14', meal: 'lunch' }, { date: '2026-09-14', meal: 'lunch' })).toBe(0)
  })
  it('round-trips through cellKey/cellFromKey', () => {
    for (const c of [{ date: '2026-09-13', meal: 'lunch' as const }, { date: '2031-01-01', meal: 'dinner' as const }]) {
      expect(cellFromKey(cellKey(c))).toEqual(c)
    }
    expect(dayNumber('1970-01-02')).toBe(1)
  })
})

describe('romeParts', () => {
  it('converts UTC instants to Rome local date and minutes (CEST)', () => {
    expect(romeParts(new Date('2026-09-13T22:30:00Z'))).toEqual({ date: '2026-09-14', minutes: 30 })
    expect(romeParts(new Date('2026-09-13T07:59:00Z'))).toEqual({ date: '2026-09-13', minutes: 9 * 60 + 59 })
  })
  it('handles CET (winter) offset', () => {
    expect(romeParts(new Date('2026-01-13T23:30:00Z'))).toEqual({ date: '2026-01-14', minutes: 30 })
    expect(romeParts(new Date('2026-01-13T09:00:00Z'))).toEqual({ date: '2026-01-13', minutes: 600 })
  })
})
