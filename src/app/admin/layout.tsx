import type { Metadata } from 'next'
import { t } from '@/i18n/it'

// Admin pages point to their own manifest (start_url /admin), so "Add to Home Screen" from here
// installs a separate icon that opens the admin area instead of the member page.
export const metadata: Metadata = {
  manifest: '/admin.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: t.admin.appName },
}

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children
}
