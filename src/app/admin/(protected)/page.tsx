import Link from 'next/link'
import { formatDayLong, mealName, mealNameLower, t } from '@/i18n/it'
import { type IsoDate, type Meal, MEALS, addDays, isIsoDate, romeParts } from '@/lib/dates'
import { AdminToggle } from '@/components/admin/AdminToggle'
import { GuestStepper } from '@/components/admin/GuestStepper'
import { requireAdmin } from '@/server/auth'
import { db } from '@/server/db'
import { type RosterRow, isExplicit, isPresent, summarise } from './kitchen.logic'

interface GuestRow { meal: Meal; count: number; note: string | null }

export default async function KitchenPage({ searchParams }: { searchParams: Promise<{ d?: string; tutti?: string }> }) {
  await requireAdmin()
  const { d, tutti } = await searchParams
  const today = romeParts(new Date()).date
  const date: IsoDate = d && isIsoDate(d) ? d : today
  const showAll = tutti === '1'

  const [rosterRes, guestsRes, lunchDef, dinnerDef] = await Promise.all([
    db.rpc('day_roster', { p_date: date }),
    db.from('meal_guests').select('meal, count, note').eq('date', date),
    db.rpc('season_default', { p_date: date, p_meal: 'lunch' }),
    db.rpc('season_default', { p_date: date, p_meal: 'dinner' }),
  ])
  if (rosterRes.error) throw new Error(rosterRes.error.message)
  const roster = rosterRes.data as RosterRow[]
  const guests = new Map(((guestsRes.data ?? []) as GuestRow[]).map((g) => [g.meal, g]))
  const defaults: Record<Meal, boolean> = { lunch: lunchDef.data as boolean, dinner: dinnerDef.data as boolean }

  const nav = (to: IsoDate) => `/admin?d=${to}${showAll ? '&tutti=1' : ''}`

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{t.admin.kitchen.title}</h1>
        <div className="no-print flex items-center gap-2">
          <Link href={nav(addDays(date, -1))} aria-label={t.admin.kitchen.prevDay} className="rounded border px-3 py-1">‹</Link>
          <form action="/admin" className="flex items-center gap-2">
            <input type="date" name="d" defaultValue={date} className="rounded border px-2 py-1" />
            {showAll && <input type="hidden" name="tutti" value="1" />}
            <button type="submit" className="rounded border px-3 py-1">OK</button>
          </form>
          <Link href={nav(addDays(date, 1))} aria-label={t.admin.kitchen.nextDay} className="rounded border px-3 py-1">›</Link>
        </div>
        <span className="text-lg capitalize">{formatDayLong(date)}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {MEALS.map((meal) => {
          const s = summarise(roster, meal)
          const g = guests.get(meal)
          const guestCount = g?.count ?? 0
          const defaultPresent = defaults[meal]
          const listed = roster.filter((r) => isPresent(r, meal) !== defaultPresent)
          return (
            <section key={meal} className="rounded-xl bg-white p-4 shadow-sm" data-testid={`meal-${meal}`}>
              <h2 className="text-xl font-semibold">{mealName[meal]}</h2>
              <p className="mt-1 text-3xl font-bold" data-testid={`total-${meal}`}>
                {s.total + guestCount} <span className="text-base font-normal text-neutral-500">{t.admin.kitchen.total}</span>
              </p>
              <p className="text-sm text-neutral-600">
                {t.admin.kitchen.community} {s.total}
                {s.byGroup.length > 1 && <> ({s.byGroup.map(([name, n]) => `${name} ${n}`).join(' · ')})</>}
                {' · '}{t.admin.kitchen.guests} {guestCount}
              </p>
              <div className="no-print"><GuestStepper date={date} meal={meal} count={guestCount} note={g?.note ?? null} /></div>
              {g?.note && <p className="hidden text-sm print:block">{t.admin.kitchen.guests}: {g.note}</p>}

              <h3 className="mt-4 font-medium">
                {defaultPresent ? t.admin.kitchen.absentAt(mealNameLower[meal]) : t.admin.kitchen.presentAt(mealNameLower[meal])} ({listed.length})
                <span className="ml-2 text-xs font-normal text-neutral-500">{defaultPresent ? t.admin.kitchen.defaultPresent : t.admin.kitchen.defaultAbsent}</span>
              </h3>
              <ul className="mt-2 divide-y text-sm">
                {(showAll ? roster : listed).length === 0 && <li className="py-1 text-neutral-500">{t.admin.kitchen.nobody}</li>}
                {(showAll ? roster : listed).map((r) => (
                  <li key={r.person_id} className="flex items-center justify-between py-1">
                    <span>{r.full_name}{r.group_name && <span className="ml-2 text-xs text-neutral-500">{r.group_name}</span>}</span>
                    <span className="no-print"><AdminToggle personId={r.person_id} date={date} meal={meal} present={isPresent(r, meal)} explicit={isExplicit(r, meal)} /></span>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>

      <div className="no-print mt-4 flex gap-4 text-sm">
        <Link href={`/admin?d=${date}${showAll ? '' : '&tutti=1'}`} className="text-blue-800 hover:underline">
          {showAll ? t.admin.kitchen.showExceptions : t.admin.kitchen.showAll}
        </Link>
      </div>
    </div>
  )
}
