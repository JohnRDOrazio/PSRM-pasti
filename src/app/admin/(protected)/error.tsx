'use client'
import { useEffect } from 'react'
import { t } from '@/i18n/it'

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <p role="alert" className="text-sm text-red-700">{t.genericError}</p>
      <button type="button" onClick={reset} className="mt-3 rounded-full bg-blue-800 px-4 py-2 text-sm font-semibold text-white">
        {t.retry}
      </button>
    </div>
  )
}
