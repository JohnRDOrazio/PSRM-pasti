'use client'

export interface PillProps {
  label: string
  present: boolean
  explicit: boolean
  locked: boolean
  onToggle: () => void
}

export function Pill({ label, present, explicit, locked, onToggle }: PillProps) {
  const base = 'relative flex-1 rounded-full border-2 px-3 py-3 text-center text-sm font-medium transition'
  const look = present ? 'border-blue-800 bg-blue-800 text-white' : 'border-neutral-300 bg-white text-neutral-500'
  const state = locked ? 'cursor-not-allowed opacity-40' : 'active:scale-95'
  return (
    <button
      type="button"
      aria-pressed={present}
      aria-disabled={locked}
      disabled={locked}
      onClick={onToggle}
      className={`${base} ${look} ${state}`}
    >
      {label}
      {explicit && <span aria-hidden className="absolute right-2 top-1 h-2 w-2 rounded-full bg-amber-400" />}
    </button>
  )
}
