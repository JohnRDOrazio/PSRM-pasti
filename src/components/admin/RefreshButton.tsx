'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useTransition } from 'react'
import { t } from '@/i18n/it'

/**
 * Re-renders the current route with fresh server data. Needed because an iPhone home-screen app
 * (display: standalone) has no reload button and no pull-to-refresh. Also refreshes on its own when
 * the app comes back to the foreground or is restored from the back/forward cache.
 * `updatedAt` is rendered by the server, so it only changes when fresh data has actually arrived.
 */
export function RefreshButton({ updatedAt }: { updatedAt: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  useEffect(() => {
    const refresh = () => start(() => router.refresh())
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [router])

  return (
    <div className="no-print flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => router.refresh())}
        className="flex items-center gap-1 rounded border px-3 py-1 disabled:opacity-40"
      >
        <span aria-hidden className={pending ? 'inline-block animate-spin' : 'inline-block'}>↻</span>
        {t.admin.kitchen.refresh}
      </button>
      <span data-testid="updated-at" className="text-sm text-neutral-500">{t.admin.kitchen.updatedAt(updatedAt)}</span>
    </div>
  )
}
