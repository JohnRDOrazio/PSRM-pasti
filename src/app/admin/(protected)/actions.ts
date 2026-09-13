'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { isoDateSchema, mealSchema } from '@/app/api/choices/schema'
import { requireAdmin } from '@/server/auth'
import { applyChange } from '@/server/changes'
import { db } from '@/server/db'
import { authClient } from '@/server/supabase-auth'

export async function signOut() {
  const supa = await authClient()
  await supa.auth.signOut()
  redirect('/admin/login')
}

const presenceSchema = z.object({ personId: z.uuid(), date: isoDateSchema, meal: mealSchema, state: z.boolean() })

export async function adminSetPresence(input: z.infer<typeof presenceSchema>): Promise<void> {
  const admin = await requireAdmin()
  const p = presenceSchema.parse(input)
  const r = await applyChange({
    personId: p.personId, actor: 'admin', actorUserId: admin.userId, kind: 'admin_edit',
    startDate: p.date, startMeal: p.meal, endDate: p.date, endMeal: p.meal, state: p.state,
  })
  if ('error' in r) throw new Error(r.error)
  revalidatePath('/admin')
}

const guestsSchema = z.object({
  date: isoDateSchema,
  meal: mealSchema,
  count: z.number().int().min(0).max(999),
  note: z.string().trim().max(200).optional(),
})

export async function setGuests(input: z.infer<typeof guestsSchema>): Promise<void> {
  const admin = await requireAdmin()
  const g = guestsSchema.parse(input)
  if (g.count === 0) {
    const { error } = await db.from('meal_guests').delete().eq('date', g.date).eq('meal', g.meal)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await db.from('meal_guests').upsert(
      { date: g.date, meal: g.meal, count: g.count, note: g.note || null, updated_by: admin.userId, updated_at: new Date().toISOString() },
      { onConflict: 'date,meal' },
    )
    if (error) throw new Error(error.message)
  }
  revalidatePath('/admin')
}
