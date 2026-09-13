import Link from 'next/link'
import { redirect } from 'next/navigation'
import { t } from '@/i18n/it'
import { firstUnlockedCell } from '@/lib/cutoff'
import { IntervalForm } from '@/components/IntervalForm'
import { getPersonFromCookie } from '@/server/auth'
import { getSettings } from '@/server/settings'

export default async function PeriodPage() {
  const person = await getPersonFromCookie()
  if (!person) redirect('/link-non-valido')
  const min = firstUnlockedCell(new Date(), await getSettings())
  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <Link href="/" className="text-sm text-blue-800">← {t.period.backToList}</Link>
      <h1 className="mb-4 mt-2 text-2xl font-semibold">{t.period.title}</h1>
      <IntervalForm min={min} />
    </main>
  )
}
