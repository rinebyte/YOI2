import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.SUPABASE_ANON_KEY

if (!url || !serviceKey || !anonKey) {
  throw new Error(
    'Missing Supabase env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY'
  )
}

/**
 * Admin client — uses the service-role key.
 * Only used for: verifying JWTs, admin auth operations.
 * Never expose this client to user-controlled inputs.
 */
export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/**
 * Per-request client — uses the user's JWT so that
 * Postgres Row Level Security policies are enforced.
 * All data reads/writes should go through this client.
 */
export function createUserClient(accessToken: string) {
  return createClient(url!, anonKey!, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
