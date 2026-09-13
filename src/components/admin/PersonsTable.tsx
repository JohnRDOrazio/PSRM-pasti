'use client'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { type PersonInput, type Reveal, createPerson, deletePerson, regenerateToken, setPersonActive, updatePerson } from '@/app/admin/(protected)/persone/actions'
import { formatDateTime, t } from '@/i18n/it'

export interface PersonRow {
  id: string
  full_name: string
  group_name: string | null
  notes: string | null
  active: boolean
  last_change_at: string | null
  change_count: number
}

const P = t.admin.persons

export function PersonsTable({ rows }: { rows: PersonRow[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [editing, setEditing] = useState<PersonRow | 'new' | null>(null)
  const [reveal, setReveal] = useState<Reveal | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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

  function submitForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const input: PersonInput = {
      full_name: String(fd.get('full_name') ?? ''),
      group_name: String(fd.get('group_name') ?? ''),
      notes: String(fd.get('notes') ?? ''),
    }
    run(async () => {
      if (editing === 'new') setReveal(await createPerson(input))
      else if (editing) await updatePerson(editing.id, input)
      setEditing(null)
    })
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setNotice(P.copied)
    } catch (err) {
      console.error(err)
      setNotice(t.genericError)
    }
    setTimeout(() => setNotice(null), 2000)
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => setEditing('new')} className="rounded-full bg-blue-800 px-4 py-2 text-sm font-semibold text-white">
        {P.new}
      </button>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {deleteError && <p role="alert" className="text-sm text-red-700">{deleteError}</p>}

      {reveal && (
        <section className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4" data-testid="reveal">
          <p className="text-sm font-medium">{P.linkOnce}</p>
          <code className="mt-2 block break-all rounded bg-white p-2 text-xs" data-testid="reveal-link">{reveal.link}</code>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => copy(reveal.link)} className="rounded-full border px-3 py-1 text-sm">{P.copyLink}</button>
            {notice && <span className="text-sm text-green-700">{notice}</span>}
            <button type="button" onClick={() => setReveal(null)} className="ml-auto text-sm text-neutral-600">{t.close}</button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={reveal.qr} alt={P.qr} width={256} height={256} className="mt-3 rounded bg-white p-2" />
        </section>
      )}

      {editing && (
        <form key={editing === 'new' ? 'new' : editing.id} onSubmit={submitForm} className="grid gap-3 rounded-xl bg-white p-4 shadow-sm md:grid-cols-3">
          <label className="block text-sm">
            {P.name}
            <input name="full_name" required maxLength={120} defaultValue={editing === 'new' ? '' : editing.full_name} className="mt-1 w-full rounded border p-2" />
          </label>
          <label className="block text-sm">
            {P.group}
            <input name="group_name" maxLength={60} defaultValue={editing === 'new' ? '' : editing.group_name ?? ''} className="mt-1 w-full rounded border p-2" />
          </label>
          <label className="block text-sm">
            {P.notes}
            <input name="notes" maxLength={500} defaultValue={editing === 'new' ? '' : editing.notes ?? ''} className="mt-1 w-full rounded border p-2" />
          </label>
          <div className="flex gap-2 md:col-span-3">
            <button type="submit" disabled={pending} className="rounded-full bg-blue-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{t.save}</button>
            <button type="button" onClick={() => setEditing(null)} className="rounded-full border px-4 py-2 text-sm">{t.cancel}</button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100 text-left">
            <tr>
              <th className="p-2">{P.name}</th>
              <th className="p-2">{P.group}</th>
              <th className="p-2">{P.status}</th>
              <th className="p-2">{P.lastChange}</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`border-t ${r.active ? '' : 'text-neutral-400'}`}>
                <td className="p-2">
                  {r.full_name}
                  {r.notes && <div className="text-xs text-neutral-500">{r.notes}</div>}
                </td>
                <td className="p-2">{r.group_name ?? ''}</td>
                <td className="p-2">{r.active ? P.active : P.inactive}</td>
                <td className="p-2">{r.last_change_at ? formatDateTime(r.last_change_at) : P.never}</td>
                <td className="p-2">
                  <div className="flex flex-wrap justify-end gap-2">
                    <button type="button" onClick={() => setEditing(r)} className="rounded border px-2 py-1">{t.edit}</button>
                    <button type="button" disabled={pending} onClick={() => run(async () => { setReveal(await regenerateToken(r.id)) })} className="rounded border px-2 py-1">{P.regenerate}</button>
                    <button type="button" disabled={pending} onClick={() => run(() => setPersonActive(r.id, !r.active))} className="rounded border px-2 py-1">
                      {r.active ? P.deactivate : P.activate}
                    </button>
                    {r.change_count === 0 && (confirmDelete === r.id ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(async () => {
                          const result = await deletePerson(r.id)
                          setConfirmDelete(null)
                          setDeleteError('error' in result ? P.cannotDelete : null)
                        })}
                        className="rounded bg-red-600 px-2 py-1 text-white"
                      >
                        {t.confirmDelete}
                      </button>
                    ) : (
                      <button type="button" onClick={() => { setDeleteError(null); setConfirmDelete(r.id) }} className="rounded border border-red-300 px-2 py-1 text-red-700">{t.delete}</button>
                    ))}
                    {r.change_count > 0 && <span className="self-center text-xs text-neutral-400" title={P.cannotDelete}>{t.delete}: {P.cannotDelete}</span>}
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
