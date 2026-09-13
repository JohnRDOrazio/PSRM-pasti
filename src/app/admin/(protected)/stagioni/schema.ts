import { z } from 'zod'
import { isoDateSchema } from '@/app/api/choices/schema'

const md = z.string().regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'MM-DD')
const common = { label: z.string().trim().min(1).max(60), lunch_default: z.boolean(), dinner_default: z.boolean() }

export const seasonSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('recurring'), ...common, start_md: md, end_md: md }),
  z.object({ kind: z.literal('one_off'), ...common, start_date: isoDateSchema, end_date: isoDateSchema })
    .refine((s) => s.start_date <= s.end_date, { message: 'end before start', path: ['end_date'] }),
])
export type SeasonInput = z.infer<typeof seasonSchema>

export interface SeasonRow {
  label: string
  start_md: string | null
  end_md: string | null
  start_date: string | null
  end_date: string | null
  lunch_default: boolean
  dinner_default: boolean
}

export function toRow(s: SeasonInput): SeasonRow {
  const base = { label: s.label, lunch_default: s.lunch_default, dinner_default: s.dinner_default }
  return s.kind === 'recurring'
    ? { ...base, start_md: s.start_md, end_md: s.end_md, start_date: null, end_date: null }
    : { ...base, start_md: null, end_md: null, start_date: s.start_date, end_date: s.end_date }
}
