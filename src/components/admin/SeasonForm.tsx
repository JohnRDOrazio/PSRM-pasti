'use client'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { createSeason, deleteSeason, updateSeason } from '@/app/admin/(protected)/stagioni/actions'
import { daysInMonth, type SeasonInput } from '@/app/admin/(protected)/stagioni/schema'
import { t } from '@/i18n/it'

export interface SeasonListRow {
  id: string
  label: string
  start_md: string | null
  end_md: string | null
  start_date: string | null
  end_date: string | null
  lunch_default: boolean
  dinner_default: boolean
}

const S = t.admin.seasons

const monthFmt = new Intl.DateTimeFormat('it-IT', { month: 'long', timeZone: 'UTC' })
const MONTHS = Array.from({ length: 12 }, (_, i) => monthFmt.format(new Date(Date.UTC(2024, i, 1))))
const pad = (n: number) => String(n).padStart(2, '0')
/** 'MM-DD' → '1 ottobre'. */
function formatMd(md: string | null): string {
  if (!md) return ''
  const [m, d] = md.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]}`
}

/** Month + day dropdowns posting a single 'MM-DD' value under `name`; the day list follows the chosen month. */
function MonthDaySelect({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  const [dm, dd] = defaultValue.split('-').map(Number)
  const [month, setMonth] = useState(dm || 1)
  const [day, setDay] = useState(dd || 1)
  const max = daysInMonth(month)
  return (
    <fieldset className="block text-sm">
      <legend>{label}</legend>
      <input type="hidden" name={name} value={`${pad(month)}-${pad(day)}`} />
      <div className="mt-1 flex gap-2">
        <select aria-label={`${label} – ${S.month}`} value={month} onChange={(e) => { const m = Number(e.target.value); setMonth(m); setDay((d) => Math.min(d, daysInMonth(m))) }} className="w-full rounded border p-2">
          {MONTHS.map((n, i) => <option key={i} value={i + 1}>{n}</option>)}
        </select>
        <select aria-label={`${label} – ${S.day}`} value={day} onChange={(e) => setDay(Number(e.target.value))} className="w-20 rounded border p-2">
          {Array.from({ length: max }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
        </select>
      </div>
    </fieldset>
  )
}

function toInput(fd: FormData): SeasonInput {
  const common = {
    label: String(fd.get('label') ?? ''),
    lunch_default: fd.get('lunch_default') === 'on',
    dinner_default: fd.get('dinner_default') === 'on',
  }
  return fd.get('kind') === 'one_off'
    ? { kind: 'one_off', ...common, start_date: String(fd.get('start_date') ?? ''), end_date: String(fd.get('end_date') ?? '') }
    : { kind: 'recurring', ...common, start_md: String(fd.get('start_md') ?? ''), end_md: String(fd.get('end_md') ?? '') }
}

export function SeasonsEditor({ rows }: { rows: SeasonListRow[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [editing, setEditing] = useState<SeasonListRow | 'new' | null>(null)
  const [kind, setKind] = useState<'recurring' | 'one_off'>('recurring')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function run(fn: () => Promise<void>) {
    start(async () => {
      try {
        await fn()
        setError(null)
      } catch (err) {
        console.error(err)
        setError(t.genericError)
      } finally {
        router.refresh()
      }
    })
  }

  function open(row: SeasonListRow | 'new') {
    setEditing(row)
    setKind(row !== 'new' && row.start_date ? 'one_off' : 'recurring')
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const input = toInput(new FormData(e.currentTarget))
    run(async () => {
      if (editing === 'new') await createSeason(input)
      else if (editing) await updateSeason(editing.id, input)
      setEditing(null)
    })
  }

  const row = editing !== 'new' ? editing : null
  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">{S.hint}</p>
      <button type="button" onClick={() => open('new')} className="rounded-full bg-blue-800 px-4 py-2 text-sm font-semibold text-white">{S.add}</button>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {editing && (
        <form key={editing === 'new' ? 'new' : editing.id} onSubmit={submit} className="grid gap-3 rounded-xl bg-white p-4 shadow-sm md:grid-cols-4">
          <label className="block text-sm">{S.label}<input name="label" required defaultValue={row?.label ?? ''} className="mt-1 w-full rounded border p-2" /></label>
          <label className="block text-sm">
            {S.kind}
            <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as 'recurring' | 'one_off')} className="mt-1 w-full rounded border p-2">
              <option value="recurring">{S.recurring}</option>
              <option value="one_off">{S.oneOff}</option>
            </select>
          </label>
          {kind === 'recurring' ? (
            <>
              <MonthDaySelect name="start_md" label={S.startMd} defaultValue={row?.start_md ?? '10-01'} />
              <MonthDaySelect name="end_md" label={S.endMd} defaultValue={row?.end_md ?? '06-30'} />
            </>
          ) : (
            <>
              <label className="block text-sm">{S.startDate}<input type="date" name="start_date" required defaultValue={row?.start_date ?? ''} className="mt-1 w-full rounded border p-2" /></label>
              <label className="block text-sm">{S.endDate}<input type="date" name="end_date" required defaultValue={row?.end_date ?? ''} className="mt-1 w-full rounded border p-2" /></label>
            </>
          )}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="lunch_default" defaultChecked={row?.lunch_default ?? true} />{S.lunchDefault}</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="dinner_default" defaultChecked={row?.dinner_default ?? true} />{S.dinnerDefault}</label>
          <div className="flex gap-2 md:col-span-4">
            <button type="submit" disabled={pending} className="rounded-full bg-blue-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{t.save}</button>
            <button type="button" onClick={() => setEditing(null)} className="rounded-full border px-4 py-2 text-sm">{t.cancel}</button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-neutral-100 text-left">
          <tr><th className="p-2">{S.label}</th><th className="p-2">{S.period}</th><th className="p-2">{S.lunchDefault}</th><th className="p-2">{S.dinnerDefault}</th><th className="p-2"></th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2">{r.label}</td>
              <td className="p-2">{r.start_date ? `${r.start_date} → ${r.end_date}` : `${S.recurring}: ${formatMd(r.start_md)} → ${formatMd(r.end_md)}`}</td>
              <td className="p-2">{r.lunch_default ? t.period.present : t.period.absent}</td>
              <td className="p-2">{r.dinner_default ? t.period.present : t.period.absent}</td>
              <td className="p-2">
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => open(r)} className="rounded border px-2 py-1">{t.edit}</button>
                  {confirmDelete === r.id ? (
                    <button type="button" disabled={pending} onClick={() => run(async () => { await deleteSeason(r.id); setConfirmDelete(null) })} className="rounded bg-red-600 px-2 py-1 text-white">{t.confirmDelete}</button>
                  ) : (
                    <button type="button" onClick={() => setConfirmDelete(r.id)} className="rounded border border-red-300 px-2 py-1 text-red-700">{t.delete}</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
