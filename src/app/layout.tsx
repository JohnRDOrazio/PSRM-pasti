import type { Metadata, Viewport } from 'next'
import { SwRegister } from '@/components/SwRegister'
import { t } from '@/i18n/it'
import './globals.css'

export const metadata: Metadata = {
  title: t.appName,
  description: 'Presenze ai pasti',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: t.appName },
  icons: { apple: '/icons/icon-192.png' },
}

export const viewport: Viewport = { themeColor: '#1e3a8a', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">
        {children}
        <SwRegister />
      </body>
    </html>
  )
}
