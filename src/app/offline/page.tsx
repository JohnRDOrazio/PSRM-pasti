import { t } from '@/i18n/it'

export default function OfflinePage() {
  return (
    <main className="mx-auto max-w-md p-6 text-center">
      <h1 className="text-2xl font-semibold">{t.offline.title}</h1>
      <p className="mt-3 text-neutral-600">{t.offline.body}</p>
    </main>
  )
}
