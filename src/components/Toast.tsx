'use client'
import { useCallback, useEffect, useState } from 'react'

export function useToast() {
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null)
  useEffect(() => {
    if (!msg) return
    const id = setTimeout(() => setMsg(null), 2500)
    return () => clearTimeout(id)
  }, [msg])
  const show = useCallback((text: string, error = false) => setMsg({ text, error }), [])
  return { msg, show }
}

export function Toast({ msg }: { msg: { text: string; error: boolean } | null }) {
  if (!msg) return null
  return (
    <div
      role="status"
      className={`fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm text-white shadow ${msg.error ? 'bg-red-600' : 'bg-neutral-800'}`}
    >
      {msg.text}
    </div>
  )
}
