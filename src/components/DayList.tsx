'use client'
import { useState } from 'react'
import type { IsoDate, Meal } from '@/lib/dates'
import { mealName, t } from '@/i18n/it'
import { Pill } from './Pill'
import { Toast, useToast } from './Toast'

export interface CellState {
  present: boolean
  explicit: boolean
  locked: boolean
  defaultPresent: boolean
}
export interface DayRow {
  date: IsoDate
  label: string
  isToday: boolean
  lunch: CellState
  dinner: CellState
}

export function DayList({ rows: initial, cutoffs }: { rows: DayRow[]; cutoffs: { lunch: string; dinner: string } }) {
  const [rows, setRows] = useState(initial)
  const { msg, show } = useToast()

  async function toggle(date: IsoDate, meal: Meal) {
    const before = rows
    const row = rows.find((r) => r.date === date)!
    const cell = row[meal]
    if (cell.locked) return
    const next = !cell.present
    setRows(rows.map((r) => (r.date === date ? { ...r, [meal]: { ...cell, present: next, explicit: next !== cell.defaultPresent } } : r)))
    const res = await fetch('/api/choices', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ start_date: date, start_meal: meal, end_date: date, end_meal: meal, state: next }),
    })
    if (!res.ok) {
      setRows(before)
      show(res.status === 409 ? t.member.lockedError : t.member.saveError, true)
      return
    }
    show(t.member.saved)
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.date} className="rounded-xl bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-medium capitalize">{r.label}</span>
            {r.isToday && (
              <span className="text-xs text-neutral-500">
                {t.member.today} · {t.member.lockedAt(r.lunch.locked && !r.dinner.locked ? cutoffs.dinner : cutoffs.lunch)}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Pill label={mealName.lunch} {...r.lunch} onToggle={() => toggle(r.date, 'lunch')} />
            <Pill label={mealName.dinner} {...r.dinner} onToggle={() => toggle(r.date, 'dinner')} />
          </div>
        </div>
      ))}
      <Toast msg={msg} />
    </div>
  )
}
