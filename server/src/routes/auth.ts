import { Elysia } from 'elysia'
import { supabaseAdmin } from '../lib/supabase'
import { authPlugin } from '../plugins/auth'

/**
 * Auth routes.
 *
 * Login / registration are handled entirely client-side via
 * Supabase Google OAuth — the browser never touches these endpoints
 * for sign-in. The backend only needs:
 *
 *   GET  /auth/me      → return the authenticated user's profile
 *   POST /auth/logout  → revoke / invalidate the JWT server-side
 */
export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(authPlugin)

  // GET /auth/me — current user profile
  .get('/me', ({ user }) => ({
    id: user!.id,
    email: user!.email ?? '',
    name:
      (user!.user_metadata?.full_name as string | null) ??
      (user!.user_metadata?.name as string | null) ??
      null,
    avatar_url: (user!.user_metadata?.avatar_url as string | null) ?? null,
    created_at: user!.created_at,
  }))

  // POST /auth/logout — server-side token revocation
  .post('/logout', async ({ token }) => {
    await supabaseAdmin.auth.admin.signOut(token!)
    return { success: true }
  })
