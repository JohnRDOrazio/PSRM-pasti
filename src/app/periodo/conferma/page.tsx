import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { formatDayShort, intervalSummary, mealNameLower, stateLabel, t } from '@/i18n/it'
import type { IsoDate, Meal } from '@/lib/dates'
import { expandInterval } from '@/lib/interval'
import { UndoButton } from '@/components/UndoButton'
import { getPersonFromCookie } from '@/server/auth'
import { db } from '@/server/db'

const MAX_SHOWN = 5

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const person = await getPersonFromCookie()
  if (!person) redirect('/link-non-valido')
  const { c } = await searchParams
  if (!c) notFound()

  const { data: change, error: changeErr } = await db
    .from('changes')
    .select('id, start_date, start_meal, end_date, end_meal, state, undone_by')
    .eq('id', c)
    .eq('person_id', person.id)
    .maybeSingle()
  if (changeErr) throw new Error(changeErr.message)
  if (!change) notFound()

  const { data: entries, error: entriesErr } = await db
    .from('change_entries')
    .select('date, meal, prev_present')
    .eq('change_id', change.id)
    .not('prev_present', 'is', null)
    .order('date')
    .order('meal')
  if (entriesErr) throw new Error(entriesErr.message)
  const overwritten = (entries ?? []) as { date: IsoDate; meal: Meal; prev_present: boolean }[]
  const cells = expandInterval(change.start_date, change.start_meal, change.end_date, change.end_meal)

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <h1 className="text-2xl font-semibold">{t.period.confirmTitle}</h1>
      <p className="mt-2 text-lg">
        <strong>{stateLabel(change.state)}</strong>: {intervalSummary(cells)}
      </p>
      <p className="mt-1 text-sm text-neutral-600">{t.period.confirmKitchen}</p>

      <section className="mt-6 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="font-medium">{t.period.overwrittenTitle}</h2>
        {overwritten.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-600">{t.period.noOverwritten}</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {overwritten.slice(0, MAX_SHOWN).map((o) => (
              <li key={`${o.date}-${o.meal}`}>
                {formatDayShort(o.date)}, {mealNameLower[o.meal]}: {t.period.was} <strong>{stateLabel(o.prev_present).toLowerCase()}</strong>
              </li>
            ))}
            {overwritten.length > MAX_SHOWN && <li className="text-neutral-500">{t.period.overwrittenMore(overwritten.length - MAX_SHOWN)}</li>}
          </ul>
        )}
      </section>

      <div className="mt-6 space-y-3">
        {change.undone_by ? <p role="status" className="rounded-lg bg-neutral-100 p-3 text-sm">{t.period.undoReason.already_undone}</p> : <UndoButton changeId={change.id} />}
        <Link href="/" className="block rounded-full bg-blue-800 py-3 text-center font-semibold text-white">{t.period.backToList}</Link>
      </div>
    </main>
  )
}
