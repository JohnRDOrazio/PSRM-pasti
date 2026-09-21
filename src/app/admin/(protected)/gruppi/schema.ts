import { z } from 'zod'

export const groupSchema = z.object({ name: z.string().trim().min(1).max(60) })
export type GroupInput = z.infer<typeof groupSchema>
