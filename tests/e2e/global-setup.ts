import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { hashToken } from '../../src/server/token'

export const E2E = {
  adminEmail: 'admin@e2e.local',
  adminPassword: 'e2e-password-123',
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

  const { data: list, error: listErr } = await supa.auth.admin.listUsers()
  if (listErr) throw listErr
  let user = list.users.find((u) => u.email === E2E.adminEmail)
  if (!user) {
    const { data, error } = await supa.auth.admin.createUser({ email: E2E.adminEmail, password: E2E.adminPassword, email_confirm: true })
    if (error) throw error
    user = data.user
  }
  await sql`insert into admins (user_id) values (${user.id}) on conflict do nothing`
  await sql.end()
}
