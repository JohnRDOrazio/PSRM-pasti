export type IsoDate = string // 'YYYY-MM-DD'
export type Meal = 'lunch' | 'dinner'
export interface Cell {
  date: IsoDate
  meal: Meal
}

export const MEALS: readonly Meal[] = ['lunch', 'dinner'] as const
export const ROME_TZ = 'Europe/Rome'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000

export function isIsoDate(s: string): boolean {
  if (!ISO_RE.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

export function toUtcDate(iso: IsoDate): Date {
  return new Date(`${iso}T00:00:00Z`)
}

export function fromUtcDate(d: Date): IsoDate {
  return d.toISOString().slice(0, 10)
}

export function addDays(iso: IsoDate, n: number): IsoDate {
  const d = toUtcDate(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return fromUtcDate(d)
}

/** Days since 1970-01-01. */
export function dayNumber(iso: IsoDate): number {
  return Math.round(toUtcDate(iso).getTime() / DAY_MS)
}

export function mealOrd(m: Meal): number {
  return m === 'lunch' ? 0 : 1
}

/** Monotonic key: lunch before dinner, days in order. */
export function cellKey(c: Cell): number {
  return dayNumber(c.date) * 2 + mealOrd(c.meal)
}

export function cellFromKey(k: number): Cell {
  return { date: fromUtcDate(new Date(Math.floor(k / 2) * DAY_MS)), meal: k % 2 === 0 ? 'lunch' : 'dinner' }
}

export function compareCells(a: Cell, b: Cell): number {
  return cellKey(a) - cellKey(b)
}

const romeFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: ROME_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** Local calendar date and minutes-since-midnight in Europe/Rome for a given instant. */
export function romeParts(now: Date): { date: IsoDate; minutes: number } {
  const parts = romeFmt.formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)!.value
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  }
}
