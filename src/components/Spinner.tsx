import { t } from '@/i18n/it'

/** Route-level loading state (Next.js loading.tsx): visible immediately while the server renders the next page. */
export function Spinner() {
  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center gap-3 px-4 py-16 text-neutral-500">
      <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
      <span className="text-sm">{t.loading}</span>
    </div>
  )
}
