import { Elysia } from 'elysia'
import { supabaseAdmin, createUserClient } from '../lib/supabase'

/**
 * Auth plugin for Elysia 1.4.
 *
 * Pattern:
 *   1. `derive` extracts the user from the Bearer token (returns null fields on failure).
 *   2. `onBeforeHandle` guards — rejects requests with no valid user.
 *
 * Use `.use(authPlugin)` on any route group that requires authentication.
 * Routes defined BEFORE `.use(authPlugin)` are not protected.
 */
export const authPlugin = new Elysia({ name: 'auth-plugin' })

  // Step 1 — extract user (never throws; null on failure)
  .derive({ as: 'scoped' }, async ({ headers }) => {
    const authorization = headers['authorization']

    if (!authorization?.startsWith('Bearer ')) {
      return { user: null as null, token: null as null, db: null as null }
    }

    const token = authorization.slice(7)

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return { user: null as null, token: null as null, db: null as null }
    }

    return {
      user,
      token,
      db: createUserClient(token),
    }
  })

  // Step 2 — reject unauthenticated requests
  .onBeforeHandle({ as: 'scoped' }, ({ user, set }) => {
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized — valid Bearer token required' }
    }
  })
