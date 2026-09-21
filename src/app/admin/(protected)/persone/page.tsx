import { t } from '@/i18n/it'
import { type PersonRow, PersonsTable } from '@/components/admin/PersonsTable'
import { requireAdmin } from '@/server/auth'
import { db } from '@/server/db'

export default async function PersonsPage() {
  await requireAdmin()
  const { data, error } = await db
    .from('persons_overview')
    .select('id, full_name, group_name, dietary_notes, active, last_change_at, change_count')
    .order('active', { ascending: false })
    .order('full_name')
  if (error) throw new Error(error.message)
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">{t.admin.persons.title}</h1>
      <PersonsTable rows={data as PersonRow[]} />
    </div>
  )
}
