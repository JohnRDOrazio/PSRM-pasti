import { NextResponse } from 'next/server'
import { IntervalError, expandInterval } from '@/lib/interval'
import { getPersonFromCookie } from '@/server/auth'
import { applyChange } from '@/server/changes'
import { choiceSchema } from './schema'

export async function POST(req: Request) {
  const person = await getPersonFromCookie()
  if (!person) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const parsed = choiceSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  const b = parsed.data

  let cellCount: number
  try {
    cellCount = expandInterval(b.start_date, b.start_meal, b.end_date, b.end_meal).length
  } catch (e) {
    if (e instanceof IntervalError) return NextResponse.json({ error: e.code }, { status: 400 })
    throw e
  }

  const result = await applyChange({
    personId: person.id,
    actor: 'member',
    actorUserId: null,
    kind: cellCount === 1 ? 'toggle' : 'interval',
    startDate: b.start_date,
    startMeal: b.start_meal,
    endDate: b.end_date,
    endMeal: b.end_meal,
    state: b.state,
  })
  if ('error' in result) return NextResponse.json(result, { status: result.error === 'locked' ? 409 : 400 })
  return NextResponse.json(result)
}
