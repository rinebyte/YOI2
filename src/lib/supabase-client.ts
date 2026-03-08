import { createClient } from '@supabase/supabase-js'

const url  = import.meta.env.VITE_SUPABASE_URL
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

/**
 * Browser-side Supabase client.
 * Used only for:
 *   - Initiating Google OAuth (signInWithOAuth)
 *   - Parsing the OAuth callback (getSession / exchangeCodeForSession)
 *   - Listening to auth state changes (onAuthStateChange)
 *   - Token refresh
 *
 * All data operations go through the ElysiaJS backend.
 */
export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})
