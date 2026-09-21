import { t } from '@/i18n/it'
import { type GroupOption, type PersonRow, PersonsTable } from '@/components/admin/PersonsTable'
import { requireAdmin } from '@/server/auth'
import { db } from '@/server/db'

export default async function PersonsPage() {
  await requireAdmin()
  const [persons, groups] = await Promise.all([
    db
      .from('persons_overview')
      .select('id, full_name, group_id, group_name, dietary_notes, active, last_change_at, change_count')
      .order('active', { ascending: false })
      .order('full_name'),
    db.from('groups').select('id, name').order('name'),
  ])
  if (persons.error) throw new Error(persons.error.message)
  if (groups.error) throw new Error(groups.error.message)
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">{t.admin.persons.title}</h1>
      <PersonsTable rows={persons.data as PersonRow[]} groups={groups.data as GroupOption[]} />
    </div>
  )
}
