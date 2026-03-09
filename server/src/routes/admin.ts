import { Elysia, t } from 'elysia'
import { supabaseAdmin } from '../lib/supabase'
import { deleteFromCF } from '../lib/cloudflare'

const SYS_CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID  ?? ''
const SYS_CF_API_KEY    = process.env.CF_API_KEY     ?? ''

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

  // ── Admin Images ────────────────────────────────────────────────────

  // GET /admin/images?page=&limit=&search=&user_id=
  .get(
    '/images',
    async ({ query, set }) => {
      const { page = '1', limit = '50', search, user_id } = query

      const pageNum  = Math.max(1, Number(page))
      const limitNum = Math.min(100, Math.max(1, Number(limit)))
      const from = (pageNum - 1) * limitNum
      const to   = from + limitNum - 1

      let q = supabaseAdmin
        .from('images')
        .select('*', { count: 'exact' })
        .order('uploaded_at', { ascending: false })
        .range(from, to)

      if (search)  q = q.ilike('filename', `%${search}%`)
      if (user_id) q = q.eq('user_id', user_id)

      const { data, error: dbErr, count } = await q
      if (dbErr) { set.status = 500; return { error: dbErr.message } }

      return {
        data: data ?? [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count ?? 0,
          total_pages: Math.ceil((count ?? 0) / limitNum),
        },
      }
    },
    {
      query: t.Object({
        page:    t.Optional(t.String()),
        limit:   t.Optional(t.String()),
        search:  t.Optional(t.String()),
        user_id: t.Optional(t.String()),
      }),
    }
  )

  // DELETE /admin/images/bulk — must be before /:id to avoid param conflict
  .delete(
    '/images/bulk',
    async ({ body, set }) => {
      const { ids } = body
      if (!ids.length) { set.status = 400; return { error: 'No IDs provided' } }

      const { data: images, error: fetchErr } = await supabaseAdmin
        .from('images')
        .select('id, cf_image_id')
        .in('id', ids)

      if (fetchErr) { set.status = 500; return { error: fetchErr.message } }

      if (SYS_CF_ACCOUNT_ID && SYS_CF_API_KEY) {
        await Promise.allSettled(
          (images ?? []).map(async (img: { id: string; cf_image_id: string | null }) => {
            if (img.cf_image_id) {
              await deleteFromCF(SYS_CF_ACCOUNT_ID, SYS_CF_API_KEY, img.cf_image_id)
            }
          })
        )
      }

      const { error: dbErr } = await supabaseAdmin.from('images').delete().in('id', ids)
      if (dbErr) { set.status = 500; return { error: dbErr.message } }
      return { success: true, deleted_count: ids.length }
    },
    {
      body: t.Object({
        ids: t.Array(t.String(), { minItems: 1 }),
      }),
    }
  )

  // DELETE /admin/images/:id
  .delete('/images/:id', async ({ params, set }) => {
    const { data: image, error: fetchErr } = await supabaseAdmin
      .from('images')
      .select('id, cf_image_id')
      .eq('id', params.id)
      .single()

    if (fetchErr || !image) { set.status = 404; return { error: 'Image not found' } }

    const img = image as { id: string; cf_image_id: string | null }
    if (img.cf_image_id && SYS_CF_ACCOUNT_ID && SYS_CF_API_KEY) {
      try { await deleteFromCF(SYS_CF_ACCOUNT_ID, SYS_CF_API_KEY, img.cf_image_id) }
      catch (err) { console.error('[CF admin delete]', err) }
    }

    const { error: dbErr } = await supabaseAdmin.from('images').delete().eq('id', params.id)
    if (dbErr) { set.status = 500; return { error: dbErr.message } }
    return { success: true, deleted_id: params.id }
  })
