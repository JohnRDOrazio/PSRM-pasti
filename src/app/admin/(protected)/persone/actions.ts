'use server'
import { revalidatePath } from 'next/cache'
import QRCode from 'qrcode'
import { z } from 'zod'
import { dietaryNotesSchema } from '@/app/api/notes/schema'
import { requireAdmin } from '@/server/auth'
import { db } from '@/server/db'
import { generateToken, hashToken, personLink } from '@/server/token'

export interface Reveal {
  id: string
  token: string
  link: string
  qr: string
}

const personSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  group_name: z.string().trim().max(60).optional().transform((v) => v || null),
  dietary_notes: dietaryNotesSchema,
})
export type PersonInput = z.input<typeof personSchema>

function appBaseUrl(): string {
  const raw = process.env.APP_BASE_URL
  const prod = process.env.NODE_ENV === 'production'
  if (!raw) {
    if (prod) throw new Error('APP_BASE_URL is not set')
    return 'http://localhost:3100'
  }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('APP_BASE_URL is not a valid URL')
  }
  if (prod && url.protocol !== 'https:') throw new Error('APP_BASE_URL must use https in production')
  return raw
}

async function reveal(id: string, token: string): Promise<Reveal> {
  const link = personLink(appBaseUrl(), token)
  const qr = await QRCode.toDataURL(link, { width: 256, margin: 1 })
  return { id, token, link, qr }
}

export async function createPerson(input: PersonInput): Promise<Reveal> {
  await requireAdmin()
  const p = personSchema.parse(input)
  const token = generateToken()
  const { data, error } = await db.from('persons').insert({ ...p, token_hash: hashToken(token) }).select('id').single()
  if (error) throw new Error(error.message)
  revalidatePath('/admin/persone')
  return reveal(data.id, token)
}

export async function updatePerson(id: string, input: PersonInput): Promise<void> {
  await requireAdmin()
  const p = personSchema.parse(input)
  const { error } = await db.from('persons').update({ ...p, updated_at: new Date().toISOString() }).eq('id', z.uuid().parse(id))
  if (error) throw new Error(error.message)
  revalidatePath('/admin/persone')
}

export async function setPersonActive(id: string, active: boolean): Promise<void> {
  await requireAdmin()
  const { error } = await db.from('persons').update({ active, updated_at: new Date().toISOString() }).eq('id', z.uuid().parse(id))
  if (error) throw new Error(error.message)
  revalidatePath('/admin/persone')
}

export async function deletePerson(id: string): Promise<{ ok: true } | { error: 'has_changes' }> {
  await requireAdmin()
  const pid = z.uuid().parse(id)
  const { count, error: countError } = await db.from('changes').select('id', { count: 'exact', head: true }).eq('person_id', pid)
  if (countError) throw new Error(countError.message)
  if ((count ?? 0) > 0) return { error: 'has_changes' }
  const { error } = await db.from('persons').delete().eq('id', pid)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/persone')
  return { ok: true }
}

export async function regenerateToken(id: string): Promise<Reveal> {
  await requireAdmin()
  const pid = z.uuid().parse(id)
  const token = generateToken()
  const { error } = await db.from('persons').update({ token_hash: hashToken(token), updated_at: new Date().toISOString() }).eq('id', pid)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/persone')
  return reveal(pid, token)
}
