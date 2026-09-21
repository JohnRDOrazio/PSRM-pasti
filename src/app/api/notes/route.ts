import { NextResponse } from 'next/server'
import { getPersonFromCookie } from '@/server/auth'
import { db } from '@/server/db'
import { dietaryNotesSchema, notesBodySchema } from './schema'

/** Member updates their own dietary notes (allergies, intolerances…). */
export async function PUT(req: Request) {
  const person = await getPersonFromCookie()
  if (!person) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const parsed = notesBodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  const notes = dietaryNotesSchema.safeParse(parsed.data.dietary_notes)
  if (!notes.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })

  const { error } = await db
    .from('persons')
    .update({ dietary_notes: notes.data, updated_at: new Date().toISOString() })
    .eq('id', person.id)
  if (error) throw new Error(`persons update: ${error.message}`)
  return NextResponse.json({ dietary_notes: notes.data })
}
