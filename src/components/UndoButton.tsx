'use client'
import { useState } from 'react'
import { t } from '@/i18n/it'

export function UndoButton({ changeId }: { changeId: string }) {
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function undo() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/changes/${changeId}/undo`, { method: 'POST' })
      if (res.ok) {
        setDone(true)
        return
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      setError(t.period.undoReason[body.error ?? ''] ?? t.genericError)
    } catch {
      setError(t.genericError)
    } finally {
      setBusy(false)
    }
  }
  if (done) return <p role="status" className="rounded-lg bg-neutral-100 p-3 text-sm">{t.period.undone}</p>
  return (
    <div className="space-y-2">
      {error && <p role="status" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button type="button" onClick={undo} disabled={busy} className="w-full rounded-full border-2 border-neutral-400 py-3 font-semibold disabled:opacity-40">
        {t.period.undo}
      </button>
    </div>
  )
}
