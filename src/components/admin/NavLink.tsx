'use client'
import Link, { useLinkStatus } from 'next/link'
import { usePathname } from 'next/navigation'
import { t } from '@/i18n/it'

/** Admin nav link: highlights the current section and shows a spinner while the navigation is pending. */
export function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname()
  const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${active ? 'bg-blue-800 text-white' : 'text-blue-800 hover:bg-blue-50'}`}
    >
      {label}
      <PendingDot />
    </Link>
  )
}

function PendingDot() {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return <span role="status" aria-label={t.loading} className="ml-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
}
