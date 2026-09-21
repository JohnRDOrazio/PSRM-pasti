import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { MEMBER_COOKIE } from '@/lib/cookie'
import { db } from './db'
import { authClient } from './supabase-auth'
import { hashToken, isTokenShape } from './token'

export interface Person {
  id: string
  full_name: string
  group_name: string | null
  dietary_notes: string | null
}

export async function findPersonByToken(token: string): Promise<Person | null> {
  if (!isTokenShape(token)) return null
  const { data, error } = await db
    .from('persons_overview')
    .select('id, full_name, group_name, dietary_notes')
    .eq('token_hash', hashToken(token))
    .eq('active', true)
    .maybeSingle()
  if (error) throw new Error(`persons lookup: ${error.message}`)
  return (data as Person | null) ?? null
}

export async function getPersonFromCookie(): Promise<Person | null> {
  const store = await cookies()
  const token = store.get(MEMBER_COOKIE)?.value
  if (!token) return null
  return findPersonByToken(token)
}

export interface Admin {
  userId: string
  email: string | null
}

// Memoised per request: the layout and the page both call requireAdmin(), and each getUser() is a
// round-trip to Supabase Auth.
const getAdminStatus = cache(async (): Promise<{ user: { id: string; email: string | null } | null; admin: Admin | null }> => {
  const supa = await authClient()
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return { user: null, admin: null }
  const { data, error } = await db.from('admins').select('user_id').eq('user_id', user.id).maybeSingle()
  if (error) throw new Error(`admins lookup: ${error.message}`)
  const admin = data ? { userId: user.id, email: user.email ?? null } : null
  return { user: { id: user.id, email: user.email ?? null }, admin }
})

export async function getAdmin(): Promise<Admin | null> {
  const { admin } = await getAdminStatus()
  return admin
}

export async function requireAdmin(): Promise<Admin> {
  const { user, admin } = await getAdminStatus()
  if (!admin) redirect(user ? '/admin/login?e=noadmin' : '/admin/login')
  return admin
}
