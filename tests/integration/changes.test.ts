import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createPerson, q, resetData, rpc, sql } from './helpers'

// 2026-10-01 08:00 Rome (CEST) → nothing on/after 2026-10-01 lunch is locked.
const NOW = '2026-10-01T06:00:00Z'
const base = { p_actor: 'member', p_actor_user: null, p_now: NOW }

async function apply(person: string, s: string, sm: string, e: string, em: string, state: boolean, extra: Record<string, unknown> = {}) {
  return rpc('apply_change', { ...base, p_person: person, p_kind: s === e && sm === em ? 'toggle' : 'interval',
    p_start_date: s, p_start_meal: sm, p_end_date: e, p_end_meal: em, p_state: state, ...extra })
}
async function choices(person: string) {
  return sql`select date::text, meal::text, present from meal_choices where person_id = ${person} order by date, meal_ord(meal)`
}

afterAll(() => sql.end())
beforeEach(resetData)

describe('apply_change', () => {
  it('stores only exceptions and returns no overwrites for a fresh interval', async () => {
    const p = await createPerson()
    const r = await apply(p, '2026-10-20', 'dinner', '2026-10-21', 'lunch', false)
    expect(r.overwritten).toEqual([])
    expect(typeof r.change_id).toBe('string')
    expect(await choices(p)).toEqual([
      { date: '2026-10-20', meal: 'dinner', present: false },
      { date: '2026-10-21', meal: 'lunch', present: false },
    ])
    const entries = await q`select prev_present, new_present from change_entries where change_id = ${r.change_id}`
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({ prev_present: null, new_present: false })
  })

  it('is a no-op when the state already equals the effective value', async () => {
    const p = await createPerson()
    const r = await apply(p, '2026-10-20', 'lunch', '2026-10-20', 'dinner', true) // October: default present
    expect(await choices(p)).toEqual([])
    expect(await q`select count(*)::int as n from change_entries where change_id = ${r.change_id}`).toEqual([{ n: 0 }])
  })

  it('reports overwritten explicit choices and removes rows that return to the default', async () => {
    const p = await createPerson()
    // 2027 summer (not 2026): 2026-08-* is in the past relative to NOW (2026-10-01) and would be
    // permanently locked for a member per is_locked, regardless of cutoff — see Task 5's own
    // '2026-09-12 yesterday → locked' case. Using next year's summer keeps the same MM-DD season
    // semantics while staying in the future relative to NOW.
    await apply(p, '2027-08-08', 'lunch', '2027-08-08', 'lunch', true) // summer: explicit present
    expect(await choices(p)).toEqual([{ date: '2027-08-08', meal: 'lunch', present: true }])
    const r = await apply(p, '2027-08-05', 'lunch', '2027-08-10', 'dinner', false)
    expect(r.overwritten).toEqual([{ date: '2027-08-08', meal: 'lunch', prev_present: true }])
    expect(await choices(p)).toEqual([]) // absent == summer default → no rows
    const entries = await q`select date::text, prev_present, new_present from change_entries where change_id = ${r.change_id}`
    expect(entries).toEqual([{ date: '2027-08-08', prev_present: true, new_present: null }])
  })

  it('rejects locked cells for members and lists them, but lets admins through', async () => {
    const p = await createPerson()
    const at11 = '2026-10-14T09:00:00Z' // 11:00 CEST
    const r = await apply(p, '2026-10-14', 'lunch', '2026-10-14', 'dinner', false, { p_now: at11 })
    expect(r).toEqual({ error: 'locked', locked: [{ date: '2026-10-14', meal: 'lunch' }, { date: '2026-10-14', meal: 'dinner' }] })
    expect(await choices(p)).toEqual([])
    expect(await q`select count(*)::int as n from changes`).toEqual([{ n: 0 }])

    const ok = await apply(p, '2026-10-14', 'lunch', '2026-10-14', 'lunch', false,
      { p_now: at11, p_actor: 'admin', p_actor_user: '00000000-0000-0000-0000-000000000001', p_kind: 'admin_edit' })
    expect(ok.overwritten).toEqual([])
    expect(await choices(p)).toEqual([{ date: '2026-10-14', meal: 'lunch', present: false }])
  })

  it('rejects an inverted or overlong interval', async () => {
    const p = await createPerson()
    expect(await apply(p, '2026-10-20', 'dinner', '2026-10-20', 'lunch', false)).toEqual({ error: 'invalid_interval' })
    expect(await apply(p, '2026-01-01', 'lunch', '2027-12-31', 'dinner', false)).toEqual({ error: 'too_long' })
  })

  it('rejects p_kind = undo', async () => {
    const p = await createPerson()
    const r = await apply(p, '2026-10-20', 'lunch', '2026-10-20', 'lunch', false, { p_kind: 'undo' })
    expect(r).toEqual({ error: 'invalid_kind' })
    expect(await q`select count(*)::int as n from changes`).toEqual([{ n: 0 }])
    expect(await choices(p)).toEqual([])
  })
})

describe('apply_change concurrency', () => {
  it('double-tap: two concurrent calls with the same state write only one entry', async () => {
    // October: season default present=true for both meals, so p_state=false differs from the
    // default for both concurrent calls — neither call is a no-op on its own. Without the
    // per-person advisory lock, both would read the (still absent) exception row concurrently
    // under read-committed and each write its own change_entries row (2 entries, both prev
    // null) — a duplicate, redundant write. With the lock, the second call must observe the
    // first's committed meal_choices row (present=false, already equal to p_state) and skip.
    const p = await createPerson()
    const [a, b] = await Promise.all([
      apply(p, '2026-10-20', 'lunch', '2026-10-20', 'lunch', false),
      apply(p, '2026-10-20', 'lunch', '2026-10-20', 'lunch', false),
    ])
    expect(typeof a.change_id).toBe('string')
    expect(typeof b.change_id).toBe('string')
    expect(await q`select count(*)::int as n from changes`).toEqual([{ n: 2 }])

    const entries = await q`select prev_present, new_present from change_entries where change_id in (${a.change_id}, ${b.change_id})`
    expect(entries).toEqual([{ prev_present: null, new_present: false }])

    expect(await choices(p)).toEqual([{ date: '2026-10-20', meal: 'lunch', present: false }])
  })
})

describe('undo_change', () => {
  it('restores previous values and marks the change undone', async () => {
    const p = await createPerson()
    // 2027 summer, not 2026 — see the note in apply_change's overwritten-choices test above.
    await apply(p, '2027-08-08', 'lunch', '2027-08-08', 'lunch', true)
    const r = await apply(p, '2027-08-07', 'lunch', '2027-08-09', 'dinner', false)
    const u = await rpc('undo_change', { p_change: r.change_id, p_person: p, p_now: NOW })
    expect(typeof u.change_id).toBe('string')
    expect(await choices(p)).toEqual([{ date: '2027-08-08', meal: 'lunch', present: true }])
    const [orig] = await q`select undone_by, kind::text from changes where id = ${r.change_id}`
    expect(orig.undone_by).toBe(u.change_id)
    const [undo] = await q`select kind::text from changes where id = ${u.change_id}`
    expect(undo.kind).toBe('undo')
  })

  it('refuses a second undo, an undo of an undo, and admin changes', async () => {
    const p = await createPerson()
    const r = await apply(p, '2026-10-20', 'lunch', '2026-10-20', 'lunch', false)
    const u = await rpc('undo_change', { p_change: r.change_id, p_person: p, p_now: NOW })
    expect(await rpc('undo_change', { p_change: r.change_id, p_person: p, p_now: NOW })).toEqual({ error: 'already_undone' })
    expect(await rpc('undo_change', { p_change: u.change_id, p_person: p, p_now: NOW })).toEqual({ error: 'not_undoable' })
    const a = await apply(p, '2026-10-21', 'lunch', '2026-10-21', 'lunch', false,
      { p_actor: 'admin', p_actor_user: '00000000-0000-0000-0000-000000000001', p_kind: 'admin_edit' })
    expect(await rpc('undo_change', { p_change: a.change_id, p_person: p, p_now: NOW })).toEqual({ error: 'not_undoable' })
  })

  it('refuses when a later change touched one of its cells', async () => {
    const p = await createPerson()
    const r = await apply(p, '2026-10-20', 'lunch', '2026-10-21', 'dinner', false)
    await apply(p, '2026-10-21', 'dinner', '2026-10-21', 'dinner', true, { p_now: '2026-10-01T06:01:00Z' })
    expect(await rpc('undo_change', { p_change: r.change_id, p_person: p, p_now: NOW })).toEqual({ error: 'superseded' })
  })

  it('refuses after 24 hours and for another person', async () => {
    const p = await createPerson()
    const q = await createPerson('Other')
    const r = await apply(p, '2026-10-20', 'lunch', '2026-10-20', 'lunch', false)
    expect(await rpc('undo_change', { p_change: r.change_id, p_person: q, p_now: NOW })).toEqual({ error: 'not_found' })
    expect(await rpc('undo_change', { p_change: r.change_id, p_person: p, p_now: '2026-10-02T06:01:00Z' })).toEqual({ error: 'too_old' })
  })

  it('refuses to undo once a touched cell has passed its cutoff, even within 24h', async () => {
    const p = await createPerson()
    // Applied at 2026-10-13T20:00:00Z (22:00 CEST, cell still in the future → not locked then).
    // Undo attempted 13h later at 2026-10-14T09:00:00Z (11:00 CEST) — within the 24h undo window,
    // but the lunch cutoff (10:00) for 2026-10-14 has now passed.
    const r = await apply(p, '2026-10-14', 'lunch', '2026-10-14', 'lunch', false, { p_now: '2026-10-13T20:00:00Z' })
    expect(await rpc('undo_change', { p_change: r.change_id, p_person: p, p_now: '2026-10-14T09:00:00Z' }))
      .toEqual({ error: 'locked' })
    expect(await choices(p)).toEqual([{ date: '2026-10-14', meal: 'lunch', present: false }])
  })

  it('allows undo of the same change before its cutoff', async () => {
    const p = await createPerson()
    const r = await apply(p, '2026-10-14', 'lunch', '2026-10-14', 'lunch', false, { p_now: '2026-10-13T06:00:00Z' })
    const u = await rpc('undo_change', { p_change: r.change_id, p_person: p, p_now: '2026-10-14T06:00:00Z' }) // 08:00 CEST, before cutoff
    expect(typeof u.change_id).toBe('string')
    expect(await choices(p)).toEqual([])
  })
})

describe('effective_presence and day_roster', () => {
  it('resolves explicit → season default per cell', async () => {
    const p = await createPerson('Anna', 'Suore')
    await apply(p, '2026-10-20', 'dinner', '2026-10-20', 'dinner', false)
    const rows = await rpc('effective_presence', { p_person: p, p_from: '2026-10-20', p_to: '2026-10-21' })
    expect(rows).toEqual([
      { date: '2026-10-20', meal: 'lunch', present: true, explicit: false, default_present: true },
      { date: '2026-10-20', meal: 'dinner', present: false, explicit: true, default_present: true },
      { date: '2026-10-21', meal: 'lunch', present: true, explicit: false, default_present: true },
      { date: '2026-10-21', meal: 'dinner', present: true, explicit: false, default_present: true },
    ])
  })

  it('lists active people with per-meal flags', async () => {
    const a = await createPerson('Anna', 'Suore')
    const b = await createPerson('Bruno', 'Sacerdoti')
    await sql`insert into persons (full_name, token_hash, active) values ('Inattivo', 'x', false)`
    await apply(a, '2026-10-20', 'lunch', '2026-10-20', 'lunch', false)
    const rows = await rpc('day_roster', { p_date: '2026-10-20' })
    expect(rows).toEqual([
      { person_id: b, full_name: 'Bruno', group_name: 'Sacerdoti', lunch_present: true, lunch_explicit: false, dinner_present: true, dinner_explicit: false },
      { person_id: a, full_name: 'Anna', group_name: 'Suore', lunch_present: false, lunch_explicit: true, dinner_present: true, dinner_explicit: false },
    ])
  })
})
