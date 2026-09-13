import 'server-only'
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
}

export async function findPersonByToken(token: string): Promise<Person | null> {
  if (!isTokenShape(token)) return null
  const { data } = await db
    .from('persons')
    .select('id, full_name, group_name')
    .eq('token_hash', hashToken(token))
    .eq('active', true)
    .maybeSingle()
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

export async function getAdmin(): Promise<Admin | null> {
  const supa = await authClient()
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return null
  const { data } = await db.from('admins').select('user_id').eq('user_id', user.id).maybeSingle()
  return data ? { userId: user.id, email: user.email ?? null } : null
}

export async function requireAdmin(): Promise<Admin> {
  const admin = await getAdmin()
  if (!admin) redirect('/admin/login')
  return admin
}
