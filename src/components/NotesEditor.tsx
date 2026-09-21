'use client'
import { useState } from 'react'
import { t } from '@/i18n/it'
import { Toast, useToast } from './Toast'

const N = t.member.notes

/** Member's own dietary notes: read view with an edit toggle, saved through /api/notes. */
export function NotesEditor({ initial }: { initial: string | null }) {
  const [saved, setSaved] = useState(initial ?? '')
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState(false)
  const { msg, show } = useToast()

  function startEdit() {
    setDraft(saved)
    setEditing(true)
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending) return
    setPending(true)
    try {
      const res = await fetch('/api/notes', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dietary_notes: draft }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = (await res.json()) as { dietary_notes: string | null }
      setSaved(body.dietary_notes ?? '')
      setEditing(false)
      show(t.member.saved)
    } catch (err) {
      console.error(err)
      show(t.member.saveError, true)
    } finally {
      setPending(false)
    }
  }

  return (
    <section data-testid="dietary-notes" className="mt-3 rounded-lg bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">{N.title}</h2>
        {!editing && <button type="button" onClick={startEdit} className="text-sm text-blue-800 hover:underline">{t.edit}</button>}
      </div>
      {editing ? (
        <form onSubmit={save} className="mt-2">
          <textarea
            name="dietary_notes"
            aria-label={N.title}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder={N.placeholder}
            disabled={pending}
            className="w-full rounded border p-2 text-sm"
          />
          <p className="mt-1 text-xs text-neutral-500">{N.hint}</p>
          <div className="mt-2 flex gap-2">
            <button type="submit" disabled={pending} className="rounded-full bg-blue-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{t.save}</button>
            <button type="button" onClick={() => setEditing(false)} disabled={pending} className="rounded-full border px-4 py-2 text-sm">{t.cancel}</button>
          </div>
        </form>
      ) : (
        <p className={`mt-1 whitespace-pre-wrap text-sm ${saved ? '' : 'text-neutral-500'}`}>{saved || N.empty}</p>
      )}
      <Toast msg={msg} />
    </section>
  )
}
