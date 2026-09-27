import type { GroupOption, PersonRow } from './PersonsTable'

export interface Section {
  key: string
  label: string
  rows: PersonRow[]
}

/** Persons split by group, in the groups' order; people without a group come last. Row order within a group is kept. */
export function groupSections(rows: PersonRow[], groups: GroupOption[], withoutGroupLabel: string): Section[] {
  const known = new Set(groups.map((g) => g.id))
  const sections = groups.map((g) => ({ key: g.id, label: g.name, rows: rows.filter((r) => r.group_id === g.id) }))
  sections.push({ key: 'none', label: withoutGroupLabel, rows: rows.filter((r) => !r.group_id || !known.has(r.group_id)) })
  return sections.filter((s) => s.rows.length > 0)
}
