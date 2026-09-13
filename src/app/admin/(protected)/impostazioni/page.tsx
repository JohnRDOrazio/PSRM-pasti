import { t } from '@/i18n/it'
import { requireAdmin } from '@/server/auth'
import { getSettings } from '@/server/settings'
import { saveSettings } from './actions'

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requireAdmin()
  const { saved } = await searchParams
  const s = await getSettings()
  const S = t.admin.settings
  return (
    <div className="max-w-md">
      <h1 className="mb-4 text-2xl font-semibold">{S.title}</h1>
      <form action={saveSettings} className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
        <label className="block text-sm">
          {S.lunchCutoff}
          <input type="time" name="lunch_cutoff" defaultValue={s.lunch_cutoff} required className="mt-1 w-full rounded border p-2" />
        </label>
        <label className="block text-sm">
          {S.dinnerCutoff}
          <input type="time" name="dinner_cutoff" defaultValue={s.dinner_cutoff} required className="mt-1 w-full rounded border p-2" />
        </label>
        <button type="submit" className="rounded-full bg-blue-800 px-4 py-2 text-sm font-semibold text-white">{t.save}</button>
        {saved && <p role="status" className="text-sm text-green-700">{S.saved}</p>}
      </form>
    </div>
  )
}
