import type { IsoDate, Meal } from '@/lib/dates'
import type { CellState, DayRow } from './DayList'

/** Flip a cell's present flag and recompute whether it now differs from the season default. */
export function toggledCell(cell: CellState): CellState {
  const present = !cell.present
  return { ...cell, present, explicit: present !== cell.defaultPresent }
}

/** Replace one cell of one row, leaving every other row (and the untouched cell) referentially unchanged. */
export function setCell(rows: DayRow[], date: IsoDate, meal: Meal, cell: CellState): DayRow[] {
  return rows.map((r) => (r.date === date ? { ...r, [meal]: cell } : r))
}
