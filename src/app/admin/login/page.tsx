import { t } from '@/i18n/it'
import { LoginForm } from '@/components/admin/LoginForm'

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">{t.appName} · {t.admin.login}</h1>
      <LoginForm />
    </main>
  )
}
