import { z } from 'zod'

/** Free text (allergies, intolerances…); trimmed, empty → null. Shared by the member API and the admin form. */
export const dietaryNotesSchema = z.string().trim().max(500).optional().transform((v) => v || null)

export const notesBodySchema = z.object({ dietary_notes: z.string() })
export type NotesInput = z.infer<typeof notesBodySchema>
