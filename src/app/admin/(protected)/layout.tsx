import Link from 'next/link'
import { NavLink } from '@/components/admin/NavLink'
import { t } from '@/i18n/it'
import { getPersonFromCookie, requireAdmin } from '@/server/auth'
import { signOut } from './actions'

const NAV = [
  ['/admin', t.admin.nav.kitchen],
  ['/admin/persone', t.admin.nav.persons],
  ['/admin/gruppi', t.admin.nav.groups],
  ['/admin/stagioni', t.admin.nav.seasons],
  ['/admin/impostazioni', t.admin.nav.settings],
  ['/admin/registro', t.admin.nav.log],
  ['/admin/password', t.admin.nav.password],
] as const

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  const person = await getPersonFromCookie()
  return (
    <div className="min-h-screen">
      <nav className="no-print flex flex-wrap items-center gap-4 border-b bg-white px-4 py-3 text-sm">
        <span className="font-semibold">{t.appName}</span>
        {NAV.map(([href, label]) => (
          <NavLink key={href} href={href} label={label} />
        ))}
        <div className="ml-auto flex items-center gap-4">
          {person && <Link href="/" className="text-blue-800 hover:underline">{t.admin.myMeals}</Link>}
          <form action={signOut}>
            <button type="submit" className="text-neutral-600 hover:underline">{t.admin.logout}</button>
          </form>
        </div>
      </nav>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  )
}
