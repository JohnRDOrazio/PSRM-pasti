import 'server-only'
import { createClient } from '@supabase/supabase-js'

/** Service-role client. Never import from client components. */
export const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})
