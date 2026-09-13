'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireAdmin } from '@/server/auth'
import { db } from '@/server/db'

const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const schema = z.object({ lunch_cutoff: hm, dinner_cutoff: hm })

export async function saveSettings(formData: FormData): Promise<void> {
  await requireAdmin()
  const s = schema.parse({ lunch_cutoff: formData.get('lunch_cutoff'), dinner_cutoff: formData.get('dinner_cutoff') })
  const { error } = await db.from('settings').upsert([
    { key: 'lunch_cutoff', value: s.lunch_cutoff },
    { key: 'dinner_cutoff', value: s.dinner_cutoff },
  ])
  if (error) throw new Error(error.message)
  revalidatePath('/', 'layout')
  redirect('/admin/impostazioni?saved=1')
}
