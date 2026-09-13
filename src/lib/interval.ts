import { type Cell, type IsoDate, type Meal, cellFromKey, cellKey } from '@/lib/dates'

export const MAX_CELLS = 800

export class IntervalError extends Error {
  constructor(public readonly code: 'invalid_interval' | 'too_long') {
    super(code)
    this.name = 'IntervalError'
  }
}

/** Every meal from (startDate, startMeal) to (endDate, endMeal), inclusive, in order. */
export function expandInterval(startDate: IsoDate, startMeal: Meal, endDate: IsoDate, endMeal: Meal): Cell[] {
  const a = cellKey({ date: startDate, meal: startMeal })
  const b = cellKey({ date: endDate, meal: endMeal })
  if (b < a) throw new IntervalError('invalid_interval')
  if (b - a + 1 > MAX_CELLS) throw new IntervalError('too_long')
  const cells: Cell[] = []
  for (let k = a; k <= b; k++) cells.push(cellFromKey(k))
  return cells
}
