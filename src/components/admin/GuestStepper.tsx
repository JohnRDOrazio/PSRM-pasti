'use client'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { setGuests } from '@/app/admin/(protected)/actions'
import { Toast, useToast } from '@/components/Toast'
import { t } from '@/i18n/it'
import type { IsoDate, Meal } from '@/lib/dates'

export function GuestStepper({ date, meal, count: initial, note: initialNote }: { date: IsoDate; meal: Meal; count: number; note: string | null }) {
  const router = useRouter()
  const [count, setCount] = useState(initial)
  const [note, setNote] = useState(initialNote ?? '')
  const [pending, start] = useTransition()
  const { msg, show } = useToast()

  function save(next: number, nextNote = note) {
    if (pending) return // one upsert at a time per (date, meal); controls are disabled meanwhile
    setCount(next)
    start(async () => {
      try {
        await setGuests({ date, meal, count: next, note: nextNote })
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
      <span>{t.admin.kitchen.guests}</span>
      <button type="button" aria-label={`− ${t.admin.kitchen.guests}`} onClick={() => save(Math.max(0, count - 1))} disabled={pending || count === 0} className="h-9 w-9 rounded-full border text-lg disabled:opacity-40">−</button>
      <output aria-label={t.admin.kitchen.guests} className="w-8 text-center text-lg font-semibold">{count}</output>
      <button type="button" aria-label={`+ ${t.admin.kitchen.guests}`} onClick={() => save(count + 1)} disabled={pending} className="h-9 w-9 rounded-full border text-lg disabled:opacity-40">+</button>
      <input
        type="text"
        placeholder={t.admin.kitchen.guestNote}
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
