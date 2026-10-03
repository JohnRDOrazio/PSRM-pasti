import Link from 'next/link'
import { cookies } from 'next/headers'
import { t } from '@/i18n/it'
import { ADMIN_HINT_COOKIE } from '@/lib/cookie'

export default async function InvalidLinkPage() {
  const showAdmin = (await cookies()).has(ADMIN_HINT_COOKIE)
  return (
    <main className="mx-auto max-w-md p-6 text-center">
      <h1 className="text-2xl font-semibold">{t.invalidLink.title}</h1>
      <p className="mt-3 text-neutral-600">{t.invalidLink.body}</p>
      {showAdmin && (
        <p className="mt-6">
          <Link href="/admin" className="text-blue-800 hover:underline">{t.member.adminArea}</Link>
        </p>
      )}
    </main>
  )
}
