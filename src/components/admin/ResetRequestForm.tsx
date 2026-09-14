'use client'
import { createBrowserClient } from '@supabase/ssr'
import { useState } from 'react'
import { t } from '@/i18n/it'

export function ResetRequestForm() {
  const R = t.admin.reset
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const supa = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
      // The e-mail template links to /admin/reset/nuova?token_hash=…&type=recovery (see README).
      const { error } = await supa.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/admin/reset/nuova` })
      // GoTrue answers 200 for unknown addresses, so a neutral message never reveals whether one exists;
      // any error here is a real one (malformed e-mail, rate limit, network).
      if (error) setError(t.genericError)
      else setSent(true)
    } catch {
      setError(t.genericError)
    } finally {
      setBusy(false)
    }
  }

  if (sent) return <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{R.sent}</p>
  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">{t.admin.email}</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border p-3" required autoComplete="username" />
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={busy} className="w-full rounded-full bg-blue-800 py-3 font-semibold text-white disabled:opacity-40">
        {R.submit}
      </button>
    </form>
  )
}
