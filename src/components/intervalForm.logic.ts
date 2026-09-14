import { type Cell, type IsoDate, type Meal, compareCells } from '@/lib/dates'
import { IntervalError, expandInterval } from '@/lib/interval'

export interface IntervalInput {
  startDate: IsoDate
  startMeal: Meal
  endDate: IsoDate
  endMeal: Meal
}
export type IntervalIssue = 'start_too_early' | 'invalid_interval' | 'too_long' | null

export function validateInterval(input: IntervalInput, min: Cell): { cells: Cell[]; error: IntervalIssue } {
  if (compareCells({ date: input.startDate, meal: input.startMeal }, min) < 0) return { cells: [], error: 'start_too_early' }
  try {
    return { cells: expandInterval(input.startDate, input.startMeal, input.endDate, input.endMeal), error: null }
  } catch (e) {
    if (e instanceof IntervalError) return { cells: [], error: e.code }
    throw e
  }
}
