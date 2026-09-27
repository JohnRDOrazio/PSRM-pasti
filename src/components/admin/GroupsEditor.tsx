'use client'
import { type Announcements, DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useRouter } from 'next/navigation'
import { useId, useState, useTransition } from 'react'
import { type GroupResult, createGroup, deleteGroup, moveGroup, reorderGroups, updateGroup } from '@/app/admin/(protected)/gruppi/actions'
import { t } from '@/i18n/it'

export interface GroupRow {
  id: string
  name: string
  member_count: number
}

const G = t.admin.groups

export function GroupsEditor({ rows }: { rows: GroupRow[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [editing, setEditing] = useState<GroupRow | 'new' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Order shown while dragging and until the server confirms; reset whenever fresh rows arrive.
  const [order, setOrder] = useState(rows)
  const [prevRows, setPrevRows] = useState(rows)
  if (rows !== prevRows) {
    setPrevRows(rows)
    setOrder(rows)
  }
  const dndId = useId()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  /** Runs an action; a returned business error is shown, an exception falls back to the generic message. */
  function run(fn: () => Promise<GroupResult>, onOk: () => void) {
    start(async () => {
      try {
        const r = await fn()
        if ('error' in r) {
          setError(r.error === 'duplicate' ? G.duplicate : G.inUse)
        } else {
          setError(null)
          onOk()
        }
      } catch (err) {
        console.error(err)
        setError(t.genericError)
      } finally {
        router.refresh()
      }
    })
  }

  // Screen-reader messages in Italian, naming groups instead of their ids.
  const nameOf = (id: string | number) => order.find((g) => g.id === id)?.name ?? ''
  const announcements: Announcements = {
    onDragStart: ({ active }) => G.drag.picked(nameOf(active.id)),
    onDragOver: ({ active, over }) => (over ? G.drag.over(nameOf(active.id), nameOf(over.id)) : undefined),
    onDragEnd: ({ active, over }) => (over ? G.drag.dropped(nameOf(active.id), nameOf(over.id)) : G.drag.cancelled(nameOf(active.id))),
    onDragCancel: ({ active }) => G.drag.cancelled(nameOf(active.id)),
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const next = arrayMove(order, order.findIndex((g) => g.id === active.id), order.findIndex((g) => g.id === over.id))
    setOrder(next)
    run(() => reorderGroups(next.map((g) => g.id)), () => {})
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const input = { name: String(new FormData(e.currentTarget).get('name') ?? '') }
    const target = editing
    run(
      () => (target === 'new' ? createGroup(input) : updateGroup(target!.id, input)),
      () => setEditing(null),
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">{G.hint}</p>
      <button type="button" onClick={() => { setError(null); setEditing('new') }} className="rounded-full bg-blue-800 px-4 py-2 text-sm font-semibold text-white">{G.add}</button>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {editing && (
        <form key={editing === 'new' ? 'new' : editing.id} onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded-xl bg-white p-4 shadow-sm">
          <label className="block text-sm">
            {G.name}
            <input name="name" required maxLength={60} defaultValue={editing === 'new' ? '' : editing.name} className="mt-1 w-full rounded border p-2" />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="rounded-full bg-blue-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{t.save}</button>
            <button type="button" onClick={() => { setError(null); setEditing(null) }} className="rounded-full border px-4 py-2 text-sm">{t.cancel}</button>
          </div>
        </form>
      )}

      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} accessibility={{ announcements, screenReaderInstructions: { draggable: G.drag.instructions } }}>
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-left">
              <tr><th className="w-8 p-2"></th><th className="p-2">{G.name}</th><th className="w-px p-2">{G.members}</th><th className="p-2"></th></tr>
            </thead>
            <SortableContext items={order.map((g) => g.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {order.length === 0 && <tr><td colSpan={4} className="p-2 text-neutral-500">{G.none}</td></tr>}
                {order.map((r, i) => (
                  <SortableRow key={r.id} id={r.id} name={r.name} disabled={pending}>
                    <td className="p-2">{r.name}</td>
                    <td className="p-2 text-center">{r.member_count}</td>
                    <td className="p-2">
                      {/* One line, so the table keeps room for all buttons; it wraps only while the wider "Confermi?" shows.
                          On phones the drag handle replaces the arrows, which would not fit. */}
                      <div className={`flex items-center justify-end gap-1 ${confirmDelete === r.id ? 'flex-wrap' : ''}`}>
                        <button type="button" disabled={pending || i === 0} onClick={() => run(() => moveGroup(r.id, 'up'), () => {})} aria-label={G.moveUp} title={G.moveUp} className="hidden rounded border px-2 py-1 disabled:opacity-40 sm:block">↑</button>
                        <button type="button" disabled={pending || i === order.length - 1} onClick={() => run(() => moveGroup(r.id, 'down'), () => {})} aria-label={G.moveDown} title={G.moveDown} className="hidden rounded border px-2 py-1 disabled:opacity-40 sm:block">↓</button>
                        <button type="button" onClick={() => { setError(null); setEditing(r) }} aria-label={t.edit} title={t.edit} className="rounded border p-1.5">
                          <PencilIcon />
                        </button>
                        {confirmDelete === r.id ? (
                          <button type="button" disabled={pending} onClick={() => run(() => deleteGroup(r.id), () => setConfirmDelete(null))} className="whitespace-nowrap rounded bg-red-600 px-1.5 py-1 text-xs font-semibold text-white">{t.confirmDelete}</button>
                        ) : (
                          <button
                            type="button"
                            disabled={r.member_count > 0}
                            aria-label={t.delete}
                            title={r.member_count > 0 ? G.inUse : t.delete}
                            onClick={() => { setError(null); setConfirmDelete(r.id) }}
                            className="rounded border border-red-300 p-1.5 text-red-700 disabled:opacity-40"
                          >
                            <TrashIcon />
                          </button>
                        )}
                      </div>
                    </td>
                  </SortableRow>
                ))}
              </tbody>
            </SortableContext>
          </table>
        </div>
      </DndContext>
    </div>
  )
}

/** A table row that can be dragged by its handle (mouse, touch or keyboard: Space, arrows, Space). */
function SortableRow({ id, name, disabled, children }: { id: string; name: string; disabled: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`border-t ${isDragging ? 'relative z-10 bg-blue-50 shadow-md' : 'bg-white'}`}
    >
      <td className="w-8 p-2">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={G.dragHandle(name)}
          title={G.dragHandle(name)}
          className="cursor-grab touch-none rounded px-1 text-lg leading-none text-neutral-400 hover:text-neutral-700 active:cursor-grabbing disabled:cursor-default"
        >
          ⠿
        </button>
      </td>
      {children}
    </tr>
  )
}

function PencilIcon() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}
