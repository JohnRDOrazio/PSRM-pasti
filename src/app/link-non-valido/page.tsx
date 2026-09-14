import { t } from '@/i18n/it'

export default function InvalidLinkPage() {
  return (
    <main className="mx-auto max-w-md p-6 text-center">
      <h1 className="text-2xl font-semibold">{t.invalidLink.title}</h1>
      <p className="mt-3 text-neutral-600">{t.invalidLink.body}</p>
    </main>
  )
}
