'use client'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { type GroupResult, createGroup, deleteGroup, updateGroup } from '@/app/admin/(protected)/gruppi/actions'
import { t } from '@/i18n/it'

export interface GroupRow {
  id: string
  name: string
  member_count: number
}

const G = t.admin.groups

export function GroupsEditor({ rows }: { rows: GroupRow[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [editing, setEditing] = useState<GroupRow | 'new' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  /** Runs an action; a returned business error is shown, an exception falls back to the generic message. */
  function run(fn: () => Promise<GroupResult>, onOk: () => void) {
    start(async () => {
      try {
        const r = await fn()
        if ('error' in r) {
          setError(r.error === 'duplicate' ? G.duplicate : G.inUse)
        } else {
          setError(null)
          onOk()
        }
      } catch (err) {
        console.error(err)
        setError(t.genericError)
      } finally {
        router.refresh()
      }
    })
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const input = { name: String(new FormData(e.currentTarget).get('name') ?? '') }
    const target = editing
    run(
      () => (target === 'new' ? createGroup(input) : updateGroup(target!.id, input)),
      () => setEditing(null),
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">{G.hint}</p>
      <button type="button" onClick={() => { setError(null); setEditing('new') }} className="rounded-full bg-blue-800 px-4 py-2 text-sm font-semibold text-white">{G.add}</button>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {editing && (
        <form key={editing === 'new' ? 'new' : editing.id} onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded-xl bg-white p-4 shadow-sm">
          <label className="block text-sm">
            {G.name}
            <input name="name" required maxLength={60} defaultValue={editing === 'new' ? '' : editing.name} className="mt-1 w-full rounded border p-2" />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="rounded-full bg-blue-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{t.save}</button>
            <button type="button" onClick={() => { setError(null); setEditing(null) }} className="rounded-full border px-4 py-2 text-sm">{t.cancel}</button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100 text-left">
            <tr><th className="p-2">{G.name}</th><th className="p-2">{G.members}</th><th className="p-2"></th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={3} className="p-2 text-neutral-500">{G.none}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.name}</td>
                <td className="p-2">{r.member_count}</td>
                <td className="p-2">
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => { setError(null); setEditing(r) }} className="rounded border px-2 py-1">{t.edit}</button>
                    {confirmDelete === r.id ? (
                      <button type="button" disabled={pending} onClick={() => run(() => deleteGroup(r.id), () => setConfirmDelete(null))} className="rounded bg-red-600 px-2 py-1 text-white">{t.confirmDelete}</button>
                    ) : (
                      <button
                        type="button"
                        disabled={r.member_count > 0}
                        title={r.member_count > 0 ? G.inUse : undefined}
                        onClick={() => { setError(null); setConfirmDelete(r.id) }}
                        className="rounded border border-red-300 px-2 py-1 text-red-700 disabled:opacity-40"
                      >
                        {t.delete}
                      </button>
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
