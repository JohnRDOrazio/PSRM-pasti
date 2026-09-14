import { z } from 'zod'
import { formatDateTime, intervalSummary, kindLabel, stateLabel, t } from '@/i18n/it'
import { type IsoDate, type Meal, isIsoDate } from '@/lib/dates'
import { expandInterval } from '@/lib/interval'
import { requireAdmin } from '@/server/auth'
import { db } from '@/server/db'

interface LogRow {
  id: string
  actor: 'member' | 'admin'
  kind: string
  start_date: IsoDate
  start_meal: Meal
  end_date: IsoDate
  end_meal: Meal
  state: boolean
  created_at: string
  undone_by: string | null
  persons: { full_name: string } | null
}

function safeIntervalSummary(r: LogRow): string {
  try {
    return intervalSummary(expandInterval(r.start_date, r.start_meal, r.end_date, r.end_meal))
  } catch {
    return '—'
  }
}

export default async function LogPage({ searchParams }: { searchParams: Promise<{ p?: string; from?: string; to?: string }> }) {
  await requireAdmin()
  const { p, from, to } = await searchParams
  const L = t.admin.log

  const { data: persons } = await db.from('persons').select('id, full_name').order('full_name')
  let q = db
    .from('changes')
    .select('id, actor, kind, start_date, start_meal, end_date, end_meal, state, created_at, undone_by, persons!changes_person_id_fkey(full_name)')
    .order('created_at', { ascending: false })
    .limit(200)
  if (p && z.uuid().safeParse(p).success) q = q.eq('person_id', p)
  if (from && isIsoDate(from)) q = q.gte('start_date', from)
  if (to && isIsoDate(to)) q = q.lte('end_date', to)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as unknown as LogRow[]

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">{L.title}</h1>
      <form className="no-print mb-4 flex flex-wrap items-end gap-3 text-sm">
        <label className="block">
          {L.person}
          <select name="p" defaultValue={p ?? ''} className="mt-1 block rounded border p-2">
            <option value="">{L.all}</option>
            {(persons ?? []).map((x) => (
              <option key={x.id} value={x.id}>{x.full_name}</option>
            ))}
          </select>
        </label>
        <label className="block">{L.from}<input type="date" name="from" defaultValue={from ?? ''} className="mt-1 block rounded border p-2" /></label>
        <label className="block">{L.to}<input type="date" name="to" defaultValue={to ?? ''} className="mt-1 block rounded border p-2" /></label>
        <button type="submit" className="rounded-full border px-4 py-2">{L.filter}</button>
      </form>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100 text-left">
            <tr>
              <th className="p-2">{L.when}</th>
              <th className="p-2">{L.person}</th>
              <th className="p-2">{L.actor}</th>
              <th className="p-2">{L.kind}</th>
              <th className="p-2">{L.interval}</th>
              <th className="p-2">{L.state}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="p-3 text-neutral-500">{L.empty}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className={`border-t ${r.undone_by ? 'text-neutral-400 line-through' : ''}`}>
                <td className="whitespace-nowrap p-2">{formatDateTime(r.created_at)}</td>
                <td className="p-2">{r.persons?.full_name ?? '—'}</td>
                <td className="p-2">{r.actor === 'admin' ? L.actorAdmin : L.actorMember}</td>
                <td className="p-2">{kindLabel(r.kind)}{r.undone_by && <span className="ml-1 text-xs">({L.undone})</span>}</td>
                <td className="p-2">{safeIntervalSummary(r)}</td>
                <td className="p-2">{stateLabel(r.state)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
