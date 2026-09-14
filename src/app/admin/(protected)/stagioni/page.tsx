import { t } from '@/i18n/it'
import { type SeasonListRow, SeasonsEditor } from '@/components/admin/SeasonForm'
import { requireAdmin } from '@/server/auth'
import { db } from '@/server/db'

export default async function SeasonsPage() {
  await requireAdmin()
  const { data, error } = await db
    .from('season_defaults')
    .select('id, label, start_md, end_md, start_date, end_date, lunch_default, dinner_default')
    .order('start_date', { ascending: true, nullsFirst: false })
    .order('start_md')
  if (error) throw new Error(error.message)
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">{t.admin.seasons.title}</h1>
      <SeasonsEditor rows={data as SeasonListRow[]} />
    </div>
  )
}
