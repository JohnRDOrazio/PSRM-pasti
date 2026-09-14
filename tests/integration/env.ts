import { execSync } from 'node:child_process'

// Populate process.env from the running local Supabase stack.
const out = execSync('npx supabase status -o env', { encoding: 'utf8' })
const env: Record<string, string> = {}
for (const line of out.split('\n')) {
  const m = /^([A-Z0-9_]+)="?(.*?)"?$/.exec(line.trim())
  if (m) env[m[1]] = m[2]
}
process.env.SUPABASE_URL ??= env.API_URL
process.env.SUPABASE_SERVICE_ROLE_KEY ??= env.SERVICE_ROLE_KEY ?? env.SECRET_KEY
process.env.DATABASE_URL ??= env.DB_URL
