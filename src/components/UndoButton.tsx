'use client'
import { useState } from 'react'
import { t } from '@/i18n/it'

export function UndoButton({ changeId }: { changeId: string }) {
  const [result, setResult] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function undo() {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/changes/${changeId}/undo`, { method: 'POST' })
      if (res.ok) {
        setResult(t.period.undone)
        return
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      setResult(t.period.undoReason[body.error ?? ''] ?? t.genericError)
    } catch {
      setResult(t.genericError)
    } finally {
      setBusy(false)
    }
  }
  if (result) return <p role="status" className="rounded-lg bg-neutral-100 p-3 text-sm">{result}</p>
  return (
    <button type="button" onClick={undo} disabled={busy} className="w-full rounded-full border-2 border-neutral-400 py-3 font-semibold">
      {t.period.undo}
    </button>
  )
}
