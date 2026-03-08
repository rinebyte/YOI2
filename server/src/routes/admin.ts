import { Elysia } from 'elysia'
import { supabaseAdmin } from '../lib/supabase'

const ADMIN_EMAIL = 'rinezpz@gmail.com'

export const adminRoutes = new Elysia({ prefix: '/admin' })

  // ── Admin auth: derive user + isAdmin ──────────────────────────────
  .derive({ as: 'scoped' }, async ({ headers }) => {
    const authorization = headers['authorization']

    if (!authorization?.startsWith('Bearer ')) {
      return { user: null as null, isAdmin: false }
    }

    const token = authorization.slice(7)

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return { user: null as null, isAdmin: false }
    }

    return {
      user,
      isAdmin: user.email === ADMIN_EMAIL,
    }
  })

  .onBeforeHandle({ as: 'scoped' }, ({ user, isAdmin, set }) => {
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized' }
    }
    if (!isAdmin) {
      set.status = 403
      return { error: 'Forbidden' }
    }
  })

  // GET /admin/users — list all users from user_approvals
  .get('/users', async ({ set }) => {
    const { data, error: dbErr } = await supabaseAdmin
      .from('user_approvals')
      .select('*')
      .order('created_at', { ascending: false })

    if (dbErr) { set.status = 500; return { error: dbErr.message } }
    return data
  })

  // POST /admin/users/:userId/approve
  .post('/users/:userId/approve', async ({ params, set }) => {
    const { data, error: dbErr } = await supabaseAdmin
      .from('user_approvals')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('user_id', params.userId)
      .select('*')
      .single()

    if (dbErr) { set.status = 500; return { error: dbErr.message } }
    if (!data)  { set.status = 404; return { error: 'User not found' } }
    return data
  })

  // POST /admin/users/:userId/reject
  .post('/users/:userId/reject', async ({ params, set }) => {
    const { data, error: dbErr } = await supabaseAdmin
      .from('user_approvals')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('user_id', params.userId)
      .select('*')
      .single()

    if (dbErr) { set.status = 500; return { error: dbErr.message } }
    if (!data)  { set.status = 404; return { error: 'User not found' } }
    return data
  })
