import { describe, expect, it } from 'vitest'
import type { DayRow } from './DayList'
import { setCell, toggledCell } from './dayList.logic'

describe('toggledCell', () => {
  it('flips present and marks explicit when it now differs from the default', () => {
    const r = toggledCell({ present: false, explicit: false, locked: false, defaultPresent: false })
    expect(r).toEqual({ present: true, explicit: true, locked: false, defaultPresent: false })
  })
  it('flips present and marks non-explicit when it now matches the default', () => {
    const r = toggledCell({ present: true, explicit: true, locked: false, defaultPresent: false })
    expect(r).toEqual({ present: false, explicit: false, locked: false, defaultPresent: false })
  })
})

describe('setCell', () => {
  const cellA = { present: true, explicit: false, locked: false, defaultPresent: true }
  const cellB = { present: false, explicit: false, locked: false, defaultPresent: false }
  const rows: DayRow[] = [
    { date: '2026-09-14', label: 'lunedì 14 settembre', isToday: false, lunch: cellA, dinner: cellA },
    { date: '2026-09-15', label: 'martedì 15 settembre', isToday: false, lunch: cellB, dinner: cellB },
  ]

  it('replaces only the target cell of the target row', () => {
    const next = setCell(rows, '2026-09-14', 'lunch', cellB)
    expect(next[0].lunch).toBe(cellB)
    expect(next[0].dinner).toBe(cellA)
  })

  it('leaves other rows referentially untouched', () => {
    const next = setCell(rows, '2026-09-14', 'lunch', cellB)
    expect(next[1]).toBe(rows[1])
    expect(next[0]).not.toBe(rows[0])
  })

  it('is a no-op copy when the date is not found', () => {
    const next = setCell(rows, '2099-01-01', 'lunch', cellB)
    expect(next[0]).toBe(rows[0])
    expect(next[1]).toBe(rows[1])
  })
})
