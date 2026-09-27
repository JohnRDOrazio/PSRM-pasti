'use client'
import { useRouter } from 'next/navigation'
import { Fragment, useState, useTransition } from 'react'
import { type PersonInput, type Reveal, createPerson, deletePerson, regenerateToken, setPersonActive, updatePerson } from '@/app/admin/(protected)/persone/actions'
import { formatDateTime, t } from '@/i18n/it'
import { PencilIcon, TrashIcon } from './icons'
import { groupSections } from './personsTable.logic'

export interface PersonRow {
  id: string
  full_name: string
  group_id: string | null
  group_name: string | null
  dietary_notes: string | null
  active: boolean
  last_change_at: string | null
  change_count: number
}

export interface GroupOption {
  id: string
  name: string
}

const P = t.admin.persons

export function PersonsTable({ rows, groups }: { rows: PersonRow[]; groups: GroupOption[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [editing, setEditing] = useState<PersonRow | 'new' | null>(null)
  const [reveal, setReveal] = useState<Reveal | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState<string | null>(null)
  const sections = groupSections(rows, groups, P.withoutGroup)

  function run(fn: () => Promise<void>) {
    start(async () => {
      try {
        await fn()
        setError(null)
      } catch (err) {
        console.error(err)
        setError(t.genericError)
      } finally {
        router.refresh()
      }
    })
  }

  function submitForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const input: PersonInput = {
      full_name: String(fd.get('full_name') ?? ''),
      group_id: String(fd.get('group_id') ?? ''),
      dietary_notes: String(fd.get('dietary_notes') ?? ''),
    }
    run(async () => {
      if (editing === 'new') setReveal(await createPerson(input))
      else if (editing) await updatePerson(editing.id, input)
      setEditing(null)
    })
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setNotice(P.copied)
    } catch (err) {
      console.error(err)
      setNotice(t.genericError)
    }
    setTimeout(() => setNotice(null), 2000)
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => { setReveal(null); setEditing('new') }} className="rounded-full bg-blue-800 px-4 py-2 text-sm font-semibold text-white">
        {P.new}
      </button>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {editing === 'new' && (
        <div ref={scrollIntoViewOnMount}>
          <PersonForm key="new" person={null} groups={groups} pending={pending} onSubmit={submitForm} onCancel={() => setEditing(null)} />
        </div>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100 text-left">
            <tr>
              <th className="p-2">{P.name}</th>
              <th className="p-2">{P.status}</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          {sections.map((section) => (
            <tbody key={section.key} aria-label={section.label}>
              <tr className="border-t bg-neutral-50">
                <th colSpan={3} scope="colgroup" className="p-2 text-left font-semibold text-blue-900">
                  {section.label} <span className="font-normal text-neutral-500">({section.rows.length})</span>
                </th>
              </tr>
              {section.rows.map((r) => (
                <Fragment key={r.id}>
                  <tr className={`border-t ${r.active ? '' : 'text-neutral-400'}`}>
                    <td className="p-2">
                      {r.full_name}
                      {r.dietary_notes && <div className="text-xs text-neutral-500">{r.dietary_notes}</div>}
                    </td>
                    <td className="p-2">
                      <ActiveSwitch active={r.active} disabled={pending} onToggle={() => run(() => setPersonActive(r.id, !r.active))} />
                      <div className="mt-1 text-xs text-neutral-500">{P.lastChange}: {r.last_change_at ? formatDateTime(r.last_change_at) : P.never}</div>
                    </td>
                    <td className="p-2">
                      {/* On phones: icons on top, "Nuovo link" below, so the column is only as wide as that button. */}
                      <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:justify-end">
                        <div className={`flex items-center justify-end gap-1 ${confirmDelete === r.id ? 'flex-wrap' : ''}`}>
                          <button type="button" onClick={() => { setReveal(null); setEditing(r) }} aria-label={t.edit} title={t.edit} className="rounded border p-1.5">
                            <PencilIcon />
                          </button>
                          {confirmDelete === r.id ? (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => run(async () => {
                                await deletePerson(r.id)
                                setConfirmDelete(null)
                              })}
                              title={r.change_count > 0 ? P.deleteAllHint : undefined}
                              className="whitespace-nowrap rounded bg-red-600 px-1.5 py-1 text-xs font-semibold text-white"
                            >
                              {/* With history, the confirmation says the history goes too. */}
                              {r.change_count > 0 ? P.confirmDeleteAll : t.confirmDelete}
                            </button>
                          ) : (
                            <button
                              type="button"
                              aria-label={t.delete}
                              title={t.delete}
                              onClick={() => setConfirmDelete(r.id)}
                              className="rounded border border-red-300 p-1.5 text-red-700 disabled:opacity-40"
                            >
                              <TrashIcon />
                            </button>
                          )}
                        </div>
                        <button type="button" disabled={pending} title={P.regenerateHint} onClick={() => { setEditing(null); setRegenerating(r.id); run(async () => { setReveal(await regenerateToken(r.id)) }) }} className="whitespace-nowrap rounded border px-2 py-1">
                          {pending && regenerating === r.id ? t.loading : P.regenerate}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* Edit form and new link open right below the person, so the click has visible feedback. */}
                  {editing !== 'new' && editing?.id === r.id && (
                    <tr ref={scrollIntoViewOnMount} className="bg-blue-50">
                      <td colSpan={3} className="p-2">
                        <PersonForm key={r.id} person={r} groups={groups} pending={pending} onSubmit={submitForm} onCancel={() => setEditing(null)} />
                      </td>
                    </tr>
                  )}
                  {reveal?.id === r.id && (
                    <tr ref={scrollIntoViewOnMount}>
                      <td colSpan={3} className="p-2">
                        <RevealPanel reveal={reveal} notice={notice} onCopy={() => copy(reveal.link)} onClose={() => setReveal(null)} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  )
}

/** On/off switch for whether the person's link works; screen readers hear "Attivo, switch, on/off". */
function ActiveSwitch({ active, disabled, onToggle }: { active: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={P.active}
      title={active ? P.deactivate : P.activate}
      disabled={disabled}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${active ? 'bg-green-600' : 'bg-neutral-300'}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${active ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
    </button>
  )
}

/** Stable ref callback (runs once per mount): brings a panel that just opened into view. */
function scrollIntoViewOnMount(el: HTMLElement | null) {
  el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

function RevealPanel({ reveal, notice, onCopy, onClose }: { reveal: Reveal; notice: string | null; onCopy: () => void; onClose: () => void }) {
  return (
    <section className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4" data-testid="reveal">
      <p className="text-sm font-medium">{P.linkOnce}</p>
      <code className="mt-2 block break-all rounded bg-white p-2 text-xs" data-testid="reveal-link">{reveal.link}</code>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={onCopy} className="rounded-full border px-3 py-1 text-sm">{P.copyLink}</button>
        {notice && <span className="text-sm text-green-700">{notice}</span>}
        <button type="button" onClick={onClose} className="ml-auto text-sm text-neutral-600">{t.close}</button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={reveal.qr} alt={P.qr} width={256} height={256} className="mt-3 rounded bg-white p-2" />
    </section>
  )
}

function PersonForm({ person, groups, pending, onSubmit, onCancel }: {
  person: PersonRow | null
  groups: GroupOption[]
  pending: boolean
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onCancel: () => void
}) {
  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-xl bg-white p-4 shadow-sm md:grid-cols-3">
      <label className="block text-sm">
        {P.name}
        <input name="full_name" required maxLength={120} defaultValue={person?.full_name ?? ''} className="mt-1 w-full rounded border p-2" />
      </label>
      <label className="block text-sm">
        {P.group}
        <select name="group_id" defaultValue={person?.group_id ?? ''} className="mt-1 w-full rounded border p-2">
          <option value="">{P.noGroup}</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </label>
      <label className="block text-sm">
        {P.dietaryNotes}
        <input name="dietary_notes" maxLength={500} defaultValue={person?.dietary_notes ?? ''} className="mt-1 w-full rounded border p-2" />
      </label>
      <div className="flex gap-2 md:col-span-3">
        <button type="submit" disabled={pending} className="rounded-full bg-blue-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{t.save}</button>
        <button type="button" onClick={onCancel} className="rounded-full border px-4 py-2 text-sm">{t.cancel}</button>
      </div>
    </form>
  )
}
