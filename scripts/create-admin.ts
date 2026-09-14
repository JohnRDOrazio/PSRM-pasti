import { createClient } from '@supabase/supabase-js'

// Run with: npx tsx scripts/create-admin.ts <email> <password>
// Wrapped in main() because the package is CommonJS (no top-level await under tsx).
async function main() {
  const [email, password] = process.argv.slice(2)
  if (!email || !password) {
    console.error('usage: tsx scripts/create-admin.ts <email> <password>')
    process.exit(1)
  }
  try {
    process.loadEnvFile('.env.local')
  } catch {
    /* env already set (CI / prod shell) */
  }

  const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Idempotent: reuse an existing auth user with this email, then ensure the admins row.
  const { data: list, error: listErr } = await supa.auth.admin.listUsers()
  if (listErr) throw listErr
  let user = list.users.find((u) => u.email === email)
  if (!user) {
    const { data, error } = await supa.auth.admin.createUser({ email, password, email_confirm: true })
    if (error) throw error
    user = data.user
  }
  const { error: insErr } = await supa.from('admins').upsert({ user_id: user.id }, { onConflict: 'user_id' })
  if (insErr) throw insErr
  console.log(`admin ready: ${email} (${user.id})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
