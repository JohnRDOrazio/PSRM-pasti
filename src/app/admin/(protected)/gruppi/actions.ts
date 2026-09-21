'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/server/auth'
import { db } from '@/server/db'
import { type GroupInput, groupSchema } from './schema'

export type GroupResult = { ok: true } | { error: 'duplicate' | 'in_use' }

const UNIQUE_VIOLATION = '23505'
const FK_VIOLATION = '23503'

function revalidate() {
  revalidatePath('/admin/gruppi')
  revalidatePath('/admin/persone')
}

export async function createGroup(input: GroupInput): Promise<GroupResult> {
  await requireAdmin()
  const { error } = await db.from('groups').insert(groupSchema.parse(input))
  if (error?.code === UNIQUE_VIOLATION) return { error: 'duplicate' }
  if (error) throw new Error(error.message)
  revalidate()
  return { ok: true }
}

export async function updateGroup(id: string, input: GroupInput): Promise<GroupResult> {
  await requireAdmin()
  const { error } = await db.from('groups').update(groupSchema.parse(input)).eq('id', z.uuid().parse(id))
  if (error?.code === UNIQUE_VIOLATION) return { error: 'duplicate' }
  if (error) throw new Error(error.message)
  revalidate()
  return { ok: true }
}

/** Refused by the FK (on delete restrict) while people still belong to the group. */
export async function deleteGroup(id: string): Promise<GroupResult> {
  await requireAdmin()
  const { error } = await db.from('groups').delete().eq('id', z.uuid().parse(id))
  if (error?.code === FK_VIOLATION) return { error: 'in_use' }
  if (error) throw new Error(error.message)
  revalidate()
  return { ok: true }
}
