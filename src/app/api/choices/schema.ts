import { z } from 'zod'
import { isIsoDate } from '@/lib/dates'

export const isoDateSchema = z.string().refine(isIsoDate, 'invalid date')
export const mealSchema = z.enum(['lunch', 'dinner'])

export const choiceSchema = z.object({
  start_date: isoDateSchema,
  start_meal: mealSchema,
  end_date: isoDateSchema,
  end_meal: mealSchema,
  state: z.boolean(),
})
export type ChoiceInput = z.infer<typeof choiceSchema>
