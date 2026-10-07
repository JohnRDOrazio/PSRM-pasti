'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/server/auth'
import { db } from '@/server/db'
import { type SeasonInput, seasonSchema, toRow } from './schema'

/** `overlap` carries the label of the season the new dates partly overlap (or duplicate). */
export type SeasonResult = { ok: true } | { error: 'overlap'; with: string }

// Raised by the season_defaults_nesting trigger, with the conflicting label as detail.
const EXCLUSION_VIOLATION = '23P01'

export async function createSeason(input: SeasonInput): Promise<SeasonResult> {
  await requireAdmin()
  const { error } = await db.from('season_defaults').insert(toRow(seasonSchema.parse(input)))
  if (error?.code === EXCLUSION_VIOLATION) return { error: 'overlap', with: error.details }
  if (error) throw new Error(error.message)
  revalidatePath('/admin/stagioni')
  return { ok: true }
}

export async function updateSeason(id: string, input: SeasonInput): Promise<SeasonResult> {
  await requireAdmin()
  const { error } = await db.from('season_defaults').update(toRow(seasonSchema.parse(input))).eq('id', z.uuid().parse(id))
  if (error?.code === EXCLUSION_VIOLATION) return { error: 'overlap', with: error.details }
  if (error) throw new Error(error.message)
  revalidatePath('/admin/stagioni')
  return { ok: true }
}

export async function deleteSeason(id: string): Promise<void> {
  await requireAdmin()
  const { error } = await db.from('season_defaults').delete().eq('id', z.uuid().parse(id))
  if (error) throw new Error(error.message)
  revalidatePath('/admin/stagioni')
}
