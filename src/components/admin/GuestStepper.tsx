'use client'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { setGuests } from '@/app/admin/(protected)/actions'
import { Toast, useToast } from '@/components/Toast'
import { t } from '@/i18n/it'
import type { IsoDate, Meal } from '@/lib/dates'

export type ExtraKind = 'guests' | 'propd'

const LABELS: Record<ExtraKind, { short: string; full: string; note: string }> = {
  guests: { short: t.admin.kitchen.guests, full: t.admin.kitchen.guests, note: t.admin.kitchen.guestNote },
  propd: { short: t.admin.kitchen.propd, full: t.admin.kitchen.propdFull, note: t.admin.kitchen.propdNote },
}

/** − / + headcount for one meal: guests, or the Propedeutico ("Propd"), with an optional note. */
export function GuestStepper({ date, meal, kind = 'guests', count: initial, note: initialNote }: { date: IsoDate; meal: Meal; kind?: ExtraKind; count: number; note: string | null }) {
  const label = LABELS[kind]
  const router = useRouter()
  const [count, setCount] = useState(initial)
  const [note, setNote] = useState(initialNote ?? '')
  // A router.refresh() (Aggiorna, auto-refresh) keeps this component's state: adopt new server
  // values, or "+" would save stale + 1 over another admin's count.
  const [prevInitial, setPrevInitial] = useState(initial)
  const [prevInitialNote, setPrevInitialNote] = useState(initialNote)
  if (initial !== prevInitial) {
    setPrevInitial(initial)
    setCount(initial)
  }
  if (initialNote !== prevInitialNote) {
    setPrevInitialNote(initialNote)
    setNote(initialNote ?? '')
  }
  const [pending, start] = useTransition()
  const { msg, show } = useToast()

  function save(next: number, nextNote = note) {
    if (pending) return // one upsert at a time per (date, meal); controls are disabled meanwhile
    setCount(next)
    start(async () => {
      try {
        await setGuests({ date, meal, kind, count: next, note: nextNote })
      } catch (err) {
        console.error(err)
        show(t.genericError, true)
        setCount(initial)
        setNote(initialNote ?? '')
      }
      router.refresh()
    })
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      {label.short === label.full ? <span>{label.short}</span> : <abbr title={label.full} className="no-underline">{label.short}</abbr>}
      <button type="button" aria-label={`− ${label.short}`} title={`− ${label.full}`} onClick={() => save(Math.max(0, count - 1))} disabled={pending || count === 0} className="h-9 w-9 rounded-full border text-lg disabled:opacity-40">−</button>
      <output aria-label={label.full} className="w-8 text-center text-lg font-semibold">{count}</output>
      <button type="button" aria-label={`+ ${label.short}`} title={`+ ${label.full}`} onClick={() => save(count + 1)} disabled={pending} className="h-9 w-9 rounded-full border text-lg disabled:opacity-40">+</button>
      <input
        type="text"
        placeholder={label.note}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => count > 0 && save(count, note)}
        disabled={pending}
        className="min-w-40 flex-1 rounded border px-2 py-1"
      />
      <Toast msg={msg} />
    </div>
  )
}
