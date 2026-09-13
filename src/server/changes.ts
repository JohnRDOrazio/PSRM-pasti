import 'server-only'
import type { Cell, IsoDate, Meal } from '@/lib/dates'
import { db } from './db'

export type Overwritten = Cell & { prev_present: boolean }
export type ApplyOk = { change_id: string; overwritten: Overwritten[] }
export type ApplyErr = { error: 'locked'; locked: Cell[] } | { error: 'invalid_interval' | 'too_long' | 'invalid_kind' }

export interface ApplyParams {
  personId: string
  actor: 'member' | 'admin'
  actorUserId: string | null
  kind: 'toggle' | 'interval' | 'admin_edit'
  startDate: IsoDate
  startMeal: Meal
  endDate: IsoDate
  endMeal: Meal
  state: boolean
}

export async function applyChange(p: ApplyParams): Promise<ApplyOk | ApplyErr> {
  const { data, error } = await db.rpc('apply_change', {
    p_person: p.personId,
    p_actor: p.actor,
    p_actor_user: p.actorUserId,
    p_kind: p.kind,
    p_start_date: p.startDate,
    p_start_meal: p.startMeal,
    p_end_date: p.endDate,
    p_end_meal: p.endMeal,
    p_state: p.state,
  })
  if (error) throw new Error(`apply_change: ${error.message}`)
  return data as ApplyOk | ApplyErr
}

export type UndoResult =
  | { change_id: string }
  | { error: 'not_found' | 'already_undone' | 'not_undoable' | 'too_old' | 'superseded' | 'locked' }

export async function undoChange(changeId: string, personId: string): Promise<UndoResult> {
  const { data, error } = await db.rpc('undo_change', { p_change: changeId, p_person: personId })
  if (error) throw new Error(`undo_change: ${error.message}`)
  return data as UndoResult
}
