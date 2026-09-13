'use server'
import { redirect } from 'next/navigation'
import { authClient } from '@/server/supabase-auth'

export async function signOut() {
  const supa = await authClient()
  await supa.auth.signOut()
  redirect('/admin/login')
}
