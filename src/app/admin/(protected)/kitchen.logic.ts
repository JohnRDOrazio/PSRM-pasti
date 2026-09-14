import type { Meal } from '@/lib/dates'

export interface RosterRow {
  person_id: string
  full_name: string
  group_name: string | null
  lunch_present: boolean
  lunch_explicit: boolean
  dinner_present: boolean
  dinner_explicit: boolean
}

export const OTHER_GROUP = 'Altri'

export function isPresent(r: RosterRow, meal: Meal): boolean {
  return meal === 'lunch' ? r.lunch_present : r.dinner_present
}
export function isExplicit(r: RosterRow, meal: Meal): boolean {
  return meal === 'lunch' ? r.lunch_explicit : r.dinner_explicit
}

/** Present headcount for a meal, overall and per group, in roster order. */
export function summarise(roster: RosterRow[], meal: Meal): { total: number; byGroup: [string, number][] } {
  const groups = new Map<string, number>()
  let total = 0
  for (const r of roster) {
    if (!isPresent(r, meal)) continue
    total++
    const g = r.group_name ?? OTHER_GROUP
    groups.set(g, (groups.get(g) ?? 0) + 1)
  }
  return { total, byGroup: [...groups.entries()] }
}
