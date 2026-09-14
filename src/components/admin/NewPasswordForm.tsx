'use client'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { PasswordInput } from '@/components/PasswordInput'
import { t } from '@/i18n/it'

const MIN_LENGTH = 8

/** Landing page of the recovery e-mail: verifies the token, then lets the admin choose a new password. */
export function NewPasswordForm() {
  const P = t.admin.changePassword
  const R = t.admin.reset
  const supa = useMemo(() => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!), [])
  const [state, setState] = useState<'verifying' | 'ready' | 'invalid' | 'done'>('verifying')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams(window.location.search)
    // Two link shapes: custom template → ?token_hash=…&type=recovery; stock Supabase template →
    // /auth/v1/verify redirects here with ?code=… (PKCE; the verifier lives in this browser's cookie).
    const tokenHash = params.get('token_hash')
    const code = params.get('code')
    const verify = async () => {
      if (params.get('type') === 'recovery' && tokenHash) {
        return supa.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
      }
      if (code) {
        // The browser client exchanges ?code= itself on initialisation (detectSessionInUrl);
        // a manual exchange would burn the one-time code. Fall back to it only if nothing was established.
        const { data: { session } } = await supa.auth.getSession()
        if (session) return { error: null }
        return supa.auth.exchangeCodeForSession(code)
      }
      return { error: new Error('missing token') }
    }
    verify().then(({ error }) => {
      if (!cancelled) setState(error ? 'invalid' : 'ready')
    })
    return () => {
      cancelled = true
    }
  }, [supa])

  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy) return
    setError(null)
    if (next.length < MIN_LENGTH) return setError(P.tooShort)
    if (next !== confirm) return setError(P.mismatch)
    setBusy(true)
    try {
      const { error } = await supa.auth.updateUser({ password: next })
      if (error) return setError(t.genericError)
      setState('done')
    } catch {
      setError(t.genericError)
    } finally {
      setBusy(false)
    }
  }

  if (state === 'verifying') return <p className="text-sm text-neutral-600">{t.loading}</p>
  if (state === 'invalid') {
    return (
      <div className="space-y-3">
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{R.invalidLink}</p>
        <Link href="/admin/reset" className="text-sm text-blue-800 hover:underline">{R.requestAgain}</Link>
      </div>
    )
  }
  if (state === 'done') {
    return (
      <div className="space-y-3">
        <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{P.saved}</p>
        <Link href="/admin" className="block rounded-full bg-blue-800 py-3 text-center font-semibold text-white">{R.goToKitchen}</Link>
      </div>
    )
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <PasswordInput label={P.next} value={next} onChange={setNext} autoComplete="new-password" />
      <PasswordInput label={P.confirm} value={confirm} onChange={setConfirm} autoComplete="new-password" />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={busy} className="w-full rounded-full bg-blue-800 py-3 font-semibold text-white disabled:opacity-40">
        {P.submit}
      </button>
    </form>
  )
}
