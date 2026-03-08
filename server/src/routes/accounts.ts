import { Elysia, t } from 'elysia'
import { authPlugin } from '../plugins/auth'
import { supabaseAdmin } from '../lib/supabase'

const ADMIN_EMAIL = 'rinezpz@gmail.com'

const ACCOUNT_SELECT = `id, user_id, name, email, color, cf_account_id, cf_images_hash, storage_limit, created_at, account_storage ( image_count, storage_used )`

export const accountRoutes = new Elysia({ prefix: '/accounts' })
  .use(authPlugin)

  // GET /accounts/me — returns (or auto-creates) the user's single account
  .get('/me', async ({ db, user, set }) => {
    const userEmail = user!.email ?? ''
    const userName =
      (user!.user_metadata?.full_name as string | null) ??
      (user!.user_metadata?.name as string | null) ??
      null
    const userAvatar = (user!.user_metadata?.avatar_url as string | null) ?? null

    // Admin bypasses approval check entirely
    if (userEmail !== ADMIN_EMAIL) {
      // Look up approval record
      const { data: approval } = await supabaseAdmin
        .from('user_approvals')
        .select('status')
        .eq('user_id', user!.id)
        .single()

      if (!approval) {
        // No record — insert pending approval and block access
        await supabaseAdmin.from('user_approvals').insert({
          user_id: user!.id,
          email: userEmail,
          name: userName,
          avatar_url: userAvatar,
          status: 'pending',
        })
        set.status = 403
        return { error: 'pending_approval', status: 'pending' }
      }

      if (approval.status === 'pending') {
        set.status = 403
        return { error: 'pending_approval', status: 'pending' }
      }

      if (approval.status === 'rejected') {
        set.status = 403
        return { error: 'rejected', status: 'rejected' }
      }
    }

    // Approved (or admin) — proceed with existing account create/return logic
    const { data: existing } = await db!
      .from('accounts')
      .select(ACCOUNT_SELECT)
      .eq('user_id', user!.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (existing) return existing

    // Auto-create on first login
    const name = userName ?? 'My Account'

    const { data: created, error: createErr } = await db!
      .from('accounts')
      .insert({
        user_id: user!.id,
        name,
        email: userEmail,
        color: '#6366f1',
        storage_limit: 1_073_741_824, // 1 GB
      })
      .select(ACCOUNT_SELECT)
      .single()

    if (createErr) { set.status = 500; return { error: createErr.message } }
    return created
  })

  // GET /accounts
  .get('/', async ({ db, user, set }) => {
    const { data, error: dbErr } = await db!
      .from('accounts')
      .select(ACCOUNT_SELECT)
      .eq('user_id', user!.id)
      .order('created_at', { ascending: true })

    if (dbErr) { set.status = 500; return { error: dbErr.message } }
    return data
  })

  // GET /accounts/:id
  .get('/:id', async ({ db, params, set }) => {
    const { data, error: dbErr } = await db!
      .from('accounts')
      .select(`
        id, user_id, name, email, color,
        cf_account_id, cf_images_hash, storage_limit, created_at,
        account_storage ( image_count, storage_used )
      `)
      .eq('id', params.id)
      .single()

    if (dbErr || !data) { set.status = 404; return { error: 'Account not found' } }
    return data
  })

  // POST /accounts
  .post(
    '/',
    async ({ db, user, body, set }) => {
      const { data, error: dbErr } = await db!
        .from('accounts')
        .insert({
          user_id: user!.id,
          name: body.name,
          email: body.email,
          color: body.color ?? '#6366f1',
          storage_limit: body.storage_limit ?? 1_073_741_824,
        })
        .select(`id, user_id, name, email, color, cf_account_id, cf_images_hash, storage_limit, created_at`)
        .single()

      if (dbErr) { set.status = 500; return { error: dbErr.message } }
      return data
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 80 }),
        email: t.String({ format: 'email' }),
        color: t.Optional(t.String()),
        storage_limit: t.Optional(t.Number({ minimum: 0 })),
      }),
    }
  )

  // PUT /accounts/:id
  .put(
    '/:id',
    async ({ db, params, body, set }) => {
      const updates: Record<string, unknown> = {}
      if (body.name !== undefined)          updates.name = body.name
      if (body.email !== undefined)         updates.email = body.email
      if (body.color !== undefined)         updates.color = body.color
      if (body.storage_limit !== undefined) updates.storage_limit = body.storage_limit

      const { data, error: dbErr } = await db!
        .from('accounts')
        .update(updates)
        .eq('id', params.id)
        .select(`id, user_id, name, email, color, cf_account_id, cf_images_hash, storage_limit, created_at`)
        .single()

      if (dbErr) { set.status = 500; return { error: dbErr.message } }
      if (!data)  { set.status = 404; return { error: 'Account not found' } }
      return data
    },
    {
      body: t.Object({
        name:         t.Optional(t.String({ minLength: 1, maxLength: 80 })),
        email:        t.Optional(t.String({ format: 'email' })),
        color:        t.Optional(t.String()),
        storage_limit: t.Optional(t.Number({ minimum: 0 })),
      }),
    }
  )

  // DELETE /accounts/:id
  .delete('/:id', async ({ db, params, set }) => {
    const { error: dbErr } = await db!.from('accounts').delete().eq('id', params.id)
    if (dbErr) { set.status = 500; return { error: dbErr.message } }
    return { success: true }
  })
