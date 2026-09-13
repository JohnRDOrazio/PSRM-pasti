import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'

export const sql = postgres(process.env.DATABASE_URL!, { max: 2 })

/** Like `sql` but returns a plain array (postgres' RowList carries extra props that break toEqual). */
export async function q<T extends Record<string, unknown> = Record<string, unknown>>(
  strings: TemplateStringsArray, ...values: unknown[]
): Promise<T[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await (sql as any)(strings, ...values)
  return [...rows].map((r) => ({ ...r })) as T[]
}
export const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

/** Empties every data table; keeps seeded seasons/settings. */
export async function resetData(): Promise<void> {
  await sql`truncate change_entries, meal_choices, changes, meal_guests, persons cascade`
}

export async function createPerson(name = 'Test Person', group: string | null = null): Promise<string> {
  const [row] = await sql`
    insert into persons (full_name, group_name, token_hash)
    values (${name}, ${group}, ${crypto.randomUUID()})
    returning id`
  return row.id as string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function rpc<T = any>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supa.rpc(fn, args)
  if (error) throw new Error(`${fn}: ${error.message}`)
  return data as T
}
