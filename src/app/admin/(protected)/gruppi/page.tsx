import { t } from '@/i18n/it'
import { type GroupRow, GroupsEditor } from '@/components/admin/GroupsEditor'
import { requireAdmin } from '@/server/auth'
import { db } from '@/server/db'

export default async function GroupsPage() {
  await requireAdmin()
  const { data, error } = await db.from('groups_overview').select('id, name, member_count').order('name')
  if (error) throw new Error(error.message)
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">{t.admin.groups.title}</h1>
      <GroupsEditor rows={data as GroupRow[]} />
    </div>
  )
}
