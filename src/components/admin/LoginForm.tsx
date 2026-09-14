'use client'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'
import { useState } from 'react'
import { PasswordInput } from '@/components/PasswordInput'
import { t } from '@/i18n/it'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const supa = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { error } = await supa.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) {
      setError(t.admin.loginError)
      return
    }
    window.location.assign('/admin')
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">{t.admin.email}</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border p-3" required autoComplete="username" />
      </label>
      <PasswordInput label={t.admin.password} value={password} onChange={setPassword} autoComplete="current-password" />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={busy} className="w-full rounded-full bg-blue-800 py-3 font-semibold text-white disabled:opacity-40">
        {t.admin.login}
      </button>
      <p className="text-center text-sm">
        <Link href="/admin/reset" className="text-blue-800 hover:underline">{t.admin.forgotPassword}</Link>
      </p>
    </form>
  )
}
