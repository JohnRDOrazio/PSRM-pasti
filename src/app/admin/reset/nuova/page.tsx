import { t } from '@/i18n/it'
import { NewPasswordForm } from '@/components/admin/NewPasswordForm'

export default function NewPasswordPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">{t.admin.reset.newTitle}</h1>
      <NewPasswordForm />
    </main>
  )
}
