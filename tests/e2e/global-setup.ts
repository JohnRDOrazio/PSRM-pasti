import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { hashToken } from '../../src/server/token'

export const E2E = {
  adminEmail: 'admin@e2e.local',
  adminPassword: 'e2e-password-123',
  nonAdminEmail: 'user@e2e.local',
  nonAdminPassword: 'e2e-password-123',
  memberToken: 'e2e'.padEnd(43, 'x'),
  memberName: 'Mario Rossi E2E',
}

export default async function globalSetup() {
  process.loadEnvFile('.env.local')
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 })
  const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  await sql`truncate change_entries, meal_choices, changes, meal_guests, persons cascade`
  await sql`insert into persons (full_name, group_name, token_hash) values (${E2E.memberName}, 'Ospiti', ${hashToken(E2E.memberToken)})`
  await sql`update settings set value = '"10:00"' where key in ('lunch_cutoff', 'dinner_cutoff')`

  // listUsers is paginated: walk every page before concluding the user is missing.
  async function findAuthUserByEmail(email: string) {
    for (let page = 1; ; page++) {
      const { data, error } = await supa.auth.admin.listUsers({ page, perPage: 200 })
      if (error) throw error
      const hit = data.users.find((u) => u.email === email)
      if (hit) return hit
      if (data.nextPage === null || data.users.length === 0) return undefined
    }
  }
  // Ensure each auth user exists with the declared password (re-sync existing ones every run).
  async function ensureUser(email: string, password: string) {
    const existing = await findAuthUserByEmail(email)
    if (existing) {
      const { error } = await supa.auth.admin.updateUserById(existing.id, { password, email_confirm: true })
      if (error) throw error
      return existing
    }
    const { data, error } = await supa.auth.admin.createUser({ email, password, email_confirm: true })
    if (error) throw error
    return data.user
  }
  const user = await ensureUser(E2E.adminEmail, E2E.adminPassword)
  await sql`insert into admins (user_id) values (${user.id}) on conflict do nothing`
  await ensureUser(E2E.nonAdminEmail, E2E.nonAdminPassword)

  await sql.end()
}
