import { describe, expect, it } from 'vitest'
import { formatDateTime, formatDayLong, formatDayShort, intervalSummary, plural, t } from './it'

describe('plural', () => {
  it('picks singular for 1 and plural otherwise', () => {
    expect(plural(1, 'pasto', 'pasti')).toBe('1 pasto')
    expect(plural(0, 'pasto', 'pasti')).toBe('0 pasti')
    expect(plural(12, 'giorno', 'giorni')).toBe('12 giorni')
  })
})

describe('date formatting', () => {
  it('formats Italian short and long day labels', () => {
    expect(formatDayShort('2026-09-20')).toBe('dom 20 set')
    expect(formatDayLong('2026-09-20')).toBe('domenica 20 settembre')
  })
  it('formats a timestamptz as gg/mm/aaaa, hh:mm in Rome time', () => {
    expect(formatDateTime('2026-09-20T08:30:00Z')).toBe('20/09/2026, 10:30') // CEST
    expect(formatDateTime('2026-01-13T09:05:00Z')).toBe('13/01/2026, 10:05') // CET
  })
})

describe('intervalSummary', () => {
  it('describes a single meal', () => {
    expect(intervalSummary([{ date: '2026-09-20', meal: 'dinner' }])).toBe('1 pasto: cena di dom 20 set')
  })
  it('describes a range meal-to-meal', () => {
    const cells = [
      { date: '2026-09-20', meal: 'lunch' as const },
      { date: '2026-09-20', meal: 'dinner' as const },
      { date: '2026-09-21', meal: 'lunch' as const },
    ]
    expect(intervalSummary(cells)).toBe('3 pasti, dal pranzo di dom 20 set al pranzo di lun 21 set')
  })
  it('uses "alla" before cena', () => {
    const cells = [
      { date: '2026-09-20', meal: 'lunch' as const },
      { date: '2026-09-20', meal: 'dinner' as const },
    ]
    expect(intervalSummary(cells)).toBe('2 pasti, dal pranzo di dom 20 set alla cena di dom 20 set')
  })
  it('has a strings table', () => {
    expect(t.member.markPeriod).toBe('Segna un periodo')
    expect(t.absentCount(1)).toBe('1 assente')
    expect(t.absentCount(2)).toBe('2 assenti')
  })
})
