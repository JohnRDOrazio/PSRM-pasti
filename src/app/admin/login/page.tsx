import { t } from '@/i18n/it'
import { LoginForm } from '@/components/admin/LoginForm'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams
  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">{t.appName} · {t.admin.login}</h1>
      {e === 'noadmin' && <p role="alert" className="mb-4 text-sm text-red-700">{t.admin.notAdmin}</p>}
      <LoginForm />
    </main>
  )
}
