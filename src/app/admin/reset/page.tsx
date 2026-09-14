import Link from 'next/link'
import { t } from '@/i18n/it'
import { ResetRequestForm } from '@/components/admin/ResetRequestForm'

export default function ResetRequestPage() {
  const R = t.admin.reset
  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="mb-2 text-2xl font-semibold">{R.title}</h1>
      <p className="mb-6 text-sm text-neutral-600">{R.intro}</p>
      <ResetRequestForm />
      <p className="mt-6 text-center text-sm">
        <Link href="/admin/login" className="text-blue-800 hover:underline">{R.backToLogin}</Link>
      </p>
    </main>
  )
}
