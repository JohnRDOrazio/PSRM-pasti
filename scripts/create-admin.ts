import { createClient } from '@supabase/supabase-js'

const [email, password] = process.argv.slice(2)
if (!email || !password) {
  console.error('usage: tsx scripts/create-admin.ts <email> <password>')
  process.exit(1)
}
try { process.loadEnvFile('.env.local') } catch { /* env already set (CI / prod shell) */ }

const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const { data, error } = await supa.auth.admin.createUser({ email, password, email_confirm: true })
if (error) throw error
const { error: insErr } = await supa.from('admins').insert({ user_id: data.user.id })
if (insErr) throw insErr
console.log(`admin created: ${email} (${data.user.id})`)
