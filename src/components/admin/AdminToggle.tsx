'use client'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { adminSetPresence } from '@/app/admin/(protected)/actions'
import { Toast, useToast } from '@/components/Toast'
import { mealName, t } from '@/i18n/it'
import type { IsoDate, Meal } from '@/lib/dates'

export function AdminToggle({ personId, date, meal, present, explicit }: { personId: string; date: IsoDate; meal: Meal; present: boolean; explicit: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const { msg, show } = useToast()
  return (
    <>
      <button
        type="button"
        aria-pressed={present}
        disabled={pending}
        onClick={() => start(async () => {
          try {
            await adminSetPresence({ personId, date, meal, state: !present })
          } catch (err) {
            console.error(err)
            show(t.genericError, true)
          }
          router.refresh()
        })}
        className={`relative rounded-full border px-3 py-1 text-xs font-medium ${present ? 'border-blue-800 bg-blue-800 text-white' : 'bg-white text-neutral-500'} disabled:opacity-40`}
      >
        {mealName[meal]}
        {explicit && <span aria-hidden className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-400" />}
      </button>
      <Toast msg={msg} />
    </>
  )
}
