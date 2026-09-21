import Link from 'next/link'
import { redirect } from 'next/navigation'
import { formatDayLong, t } from '@/i18n/it'
import { isLocked } from '@/lib/cutoff'
import { type IsoDate, type Meal, addDays, romeParts } from '@/lib/dates'
import { getPersonFromCookie } from '@/server/auth'
import { db } from '@/server/db'
import { getSettings } from '@/server/settings'
import { type DayRow, DayList } from '@/components/DayList'
import { NotesEditor } from '@/components/NotesEditor'

interface PresenceRow {
  date: IsoDate
  meal: Meal
  present: boolean
  explicit: boolean
  default_present: boolean
}

export default async function HomePage() {
  const person = await getPersonFromCookie()
  if (!person) redirect('/link-non-valido')

  const now = new Date()
  const today = romeParts(now).date
  const settings = await getSettings()
  const { data, error } = await db.rpc('effective_presence', { p_person: person.id, p_from: today, p_to: addDays(today, 29) })
  if (error) throw new Error(error.message)

  const byDate = new Map<IsoDate, DayRow>()
  for (const r of data as PresenceRow[]) {
    const row = byDate.get(r.date) ?? { date: r.date, label: formatDayLong(r.date), isToday: r.date === today, lunch: null!, dinner: null! }
    row[r.meal] = { present: r.present, explicit: r.explicit, locked: isLocked({ date: r.date, meal: r.meal }, now, settings), defaultPresent: r.default_present }
    byDate.set(r.date, row)
  }
  const rows = [...byDate.values()]
  const seasonPresent = rows[0]?.lunch.defaultPresent ?? true

  return (
    <main className="mx-auto max-w-md px-4 pb-28 pt-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">{person.full_name}</h1>
        <p className="mt-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
          {seasonPresent ? t.member.seasonPresent : t.member.seasonAbsent} {t.member.explicitHint}
        </p>
        <NotesEditor initial={person.dietary_notes} />
      </header>
      <DayList rows={rows} cutoffs={{ lunch: settings.lunch_cutoff, dinner: settings.dinner_cutoff }} />
      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-neutral-50 p-4">
        <Link href="/periodo" className="block rounded-full bg-blue-800 py-4 text-center font-semibold text-white shadow-lg">
          {t.member.markPeriod}
        </Link>
      </div>
    </main>
  )
}
