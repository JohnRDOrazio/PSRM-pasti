import { t } from '@/i18n/it'
import { ChangePasswordForm } from '@/components/admin/ChangePasswordForm'
import { requireAdmin } from '@/server/auth'

export default async function PasswordPage() {
  const admin = await requireAdmin()
  return (
    <div className="max-w-md">
      <h1 className="mb-4 text-2xl font-semibold">{t.admin.changePassword.title}</h1>
      <ChangePasswordForm email={admin.email ?? ''} />
    </div>
  )
}
