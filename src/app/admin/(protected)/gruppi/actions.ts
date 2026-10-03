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
  revalidatePath('/admin')
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

/** Moves a group one place up or down in the order used by the persons list and the kitchen. */
export async function moveGroup(id: string, direction: 'up' | 'down'): Promise<GroupResult> {
  await requireAdmin()
  const { error } = await db.rpc('move_group', { p_id: z.uuid().parse(id), p_delta: z.enum(['up', 'down']).parse(direction) === 'up' ? -1 : 1 })
  if (error) throw new Error(error.message)
  revalidate()
  return { ok: true }
}

/** Saves the order the admin dragged the groups into. */
export async function reorderGroups(ids: string[]): Promise<GroupResult> {
  await requireAdmin()
  const { error } = await db.rpc('reorder_groups', { p_ids: z.array(z.uuid()).max(500).parse(ids) })
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
