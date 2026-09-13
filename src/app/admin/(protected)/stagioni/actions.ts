'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/server/auth'
import { db } from '@/server/db'
import { type SeasonInput, seasonSchema, toRow } from './schema'

async function normalize(): Promise<void> {
  const { error } = await db.rpc('normalize_meal_choices')
  if (error) throw new Error(error.message)
}

export async function createSeason(input: SeasonInput): Promise<void> {
  await requireAdmin()
  const { error } = await db.from('season_defaults').insert(toRow(seasonSchema.parse(input)))
  if (error) throw new Error(error.message)
  await normalize()
  revalidatePath('/admin/stagioni')
}

export async function updateSeason(id: string, input: SeasonInput): Promise<void> {
  await requireAdmin()
  const { error } = await db.from('season_defaults').update(toRow(seasonSchema.parse(input))).eq('id', z.uuid().parse(id))
  if (error) throw new Error(error.message)
  await normalize()
  revalidatePath('/admin/stagioni')
}

export async function deleteSeason(id: string): Promise<void> {
  await requireAdmin()
  const { error } = await db.from('season_defaults').delete().eq('id', z.uuid().parse(id))
  if (error) throw new Error(error.message)
  await normalize()
  revalidatePath('/admin/stagioni')
}
