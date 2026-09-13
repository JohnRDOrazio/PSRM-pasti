import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getPersonFromCookie } from '@/server/auth'
import { undoChange } from '@/server/changes'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const person = await getPersonFromCookie()
  if (!person) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const result = await undoChange(id, person.id)
  if ('error' in result) return NextResponse.json(result, { status: result.error === 'not_found' ? 404 : 409 })
  return NextResponse.json(result)
}
