import { Elysia, t } from 'elysia'
import { authPlugin } from '../plugins/auth'
import { uploadToCF, deleteFromCF, deliveryUrl, thumbnailUrl } from '../lib/cloudflare'

// System-level Cloudflare credentials from environment
const SYS_CF_ACCOUNT_ID  = process.env.CF_ACCOUNT_ID  ?? ''
const SYS_CF_API_KEY     = process.env.CF_API_KEY     ?? ''
const SYS_CF_IMAGES_HASH = process.env.CF_IMAGES_HASH ?? SYS_CF_ACCOUNT_ID

interface AccountRow {
  id: string
  storage_limit: number
}

interface ImageRow {
  id: string
  cf_image_id: string | null
}

export const imageRoutes = new Elysia({ prefix: '/images' })
  .use(authPlugin)

  // ──────────────────────────────────────────────
  // GET /images?account_id=&page=&limit=&tags=&search=&is_public=
  // ──────────────────────────────────────────────
  .get(
    '/',
    async ({ db, query, set }) => {
      const { account_id, page = '1', limit = '50', search, tags, is_public } = query

      if (!account_id) { set.status = 400; return { error: 'account_id is required' } }

      const pageNum  = Math.max(1, Number(page))
      const limitNum = Math.min(100, Math.max(1, Number(limit)))
      const from = (pageNum - 1) * limitNum
      const to   = from + limitNum - 1

      let q = db!
        .from('images')
        .select('*', { count: 'exact' })
        .eq('account_id', account_id)
        .order('uploaded_at', { ascending: false })
        .range(from, to)

      if (search) q = q.ilike('filename', `%${search}%`)

      if (tags) {
        const tagArr = tags.split(',').map((tag: string) => tag.trim()).filter(Boolean)
        if (tagArr.length > 0) q = q.overlaps('tags', tagArr)
      }

      if (is_public !== undefined) q = q.eq('is_public', is_public === 'true')

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
        account_id: t.Optional(t.String()),
        page:       t.Optional(t.String()),
        limit:      t.Optional(t.String()),
        search:     t.Optional(t.String()),
        tags:       t.Optional(t.String()),
        is_public:  t.Optional(t.String()),
      }),
    }
  )

  // GET /images/:id
  .get('/:id', async ({ db, params, set }) => {
    const { data, error: dbErr } = await db!
      .from('images')
      .select('*')
      .eq('id', params.id)
      .single()

    if (dbErr || !data) { set.status = 404; return { error: 'Image not found' } }
    return data
  })

  // ──────────────────────────────────────────────
  // POST /images/upload — multipart upload to CF
  // ──────────────────────────────────────────────
  .post(
    '/upload',
    async ({ db, user, body, set }) => {
      const { file, account_id, tags: tagsRaw, is_public: isPublicStr } = body
      const isPublic = isPublicStr !== 'false'

      // 0. Verify system CF credentials are configured
      if (!SYS_CF_ACCOUNT_ID || !SYS_CF_API_KEY) {
        set.status = 503
        return { error: 'Cloudflare credentials not configured on the server.' }
      }

      // 1. Fetch account (RLS ensures user owns it)
      const { data: account, error: accErr } = await db!
        .from('accounts')
        .select('id, storage_limit')
        .eq('id', account_id)
        .single()

      if (accErr || !account) {
        set.status = 404
        return { error: 'Account not found or access denied' }
      }

      const acc = account as AccountRow

      // 2. Storage headroom check
      const { data: storageRow } = await db!
        .from('account_storage')
        .select('storage_used')
        .eq('account_id', account_id)
        .single()

      const currentUsage = (storageRow as { storage_used?: number } | null)?.storage_used ?? 0
      if (currentUsage + file.size > acc.storage_limit) {
        set.status = 413
        return { error: 'Storage limit exceeded for this account' }
      }

      // 3. Upload to Cloudflare Images
      let cfResult
      try {
        cfResult = await uploadToCF(SYS_CF_ACCOUNT_ID, SYS_CF_API_KEY, file, {
          requireSignedURLs: !isPublic,
          metadata: { original_filename: file.name, uploader: user!.id },
        })
      } catch (err) {
        set.status = 502
        return { error: String(err) }
      }

      // 4. Build delivery URLs
      const cfImageId  = cfResult.result.id
      const url     = deliveryUrl(SYS_CF_IMAGES_HASH, cfImageId, 'public')
      const thumbUrl = thumbnailUrl(SYS_CF_IMAGES_HASH, cfImageId)

      // 5. Parse tags (JSON array or CSV)
      let tags: string[] = []
      if (tagsRaw) {
        try { tags = JSON.parse(tagsRaw) }
        catch { tags = tagsRaw.split(',').map((s: string) => s.trim()).filter(Boolean) }
      }

      // 6. Persist to Supabase
      const { data: image, error: dbErr } = await db!
        .from('images')
        .insert({
          account_id,
          user_id: user!.id,
          cf_image_id: cfImageId,
          filename: file.name,
          url,
          thumbnail_url: thumbUrl,
          size: file.size,
          width: 0,
          height: 0,
          mime_type: file.type || 'image/jpeg',
          tags,
          is_public: isPublic,
        })
        .select()
        .single()

      if (dbErr) { set.status = 500; return { error: dbErr.message } }
      return image
    },
    {
      body: t.Object({
        file:       t.File({ type: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], maxSize: '10m' }),
        account_id: t.String(),
        tags:       t.Optional(t.String()),
        is_public:  t.Optional(t.String()),
      }),
    }
  )

  // ──────────────────────────────────────────────
  // PATCH /images/:id — update metadata only
  // ──────────────────────────────────────────────
  .patch(
    '/:id',
    async ({ db, params, body, set }) => {
      const updates: Record<string, unknown> = {}
      if (body.tags     !== undefined) updates.tags     = body.tags
      if (body.is_public !== undefined) updates.is_public = body.is_public
      if (body.filename  !== undefined) updates.filename  = body.filename

      const { data, error: dbErr } = await db!
        .from('images')
        .update(updates)
        .eq('id', params.id)
        .select()
        .single()

      if (dbErr) { set.status = 500; return { error: dbErr.message } }
      if (!data)  { set.status = 404; return { error: 'Image not found' } }
      return data
    },
    {
      body: t.Object({
        tags:      t.Optional(t.Array(t.String())),
        is_public: t.Optional(t.Boolean()),
        filename:  t.Optional(t.String()),
      }),
    }
  )

  // ──────────────────────────────────────────────
  // DELETE /images/:id — delete from CF + DB
  // ──────────────────────────────────────────────
  .delete('/:id', async ({ db, params, set }) => {
    const { data: image, error: fetchErr } = await db!
      .from('images')
      .select('id, cf_image_id')
      .eq('id', params.id)
      .single()

    if (fetchErr || !image) { set.status = 404; return { error: 'Image not found' } }

    const img = image as ImageRow

    if (img.cf_image_id && SYS_CF_ACCOUNT_ID && SYS_CF_API_KEY) {
      try { await deleteFromCF(SYS_CF_ACCOUNT_ID, SYS_CF_API_KEY, img.cf_image_id) }
      catch (err) { console.error('[CF delete]', err) }
    }

    const { error: dbErr } = await db!.from('images').delete().eq('id', params.id)
    if (dbErr) { set.status = 500; return { error: dbErr.message } }
    return { success: true, deleted_id: params.id }
  })

  // ──────────────────────────────────────────────
  // DELETE /images/bulk
  // ──────────────────────────────────────────────
  .delete(
    '/bulk',
    async ({ db, body, set }) => {
      const { ids } = body
      if (!ids.length) { set.status = 400; return { error: 'No image IDs provided' } }

      const { data: images, error: fetchErr } = await db!
        .from('images')
        .select('id, cf_image_id')
        .in('id', ids)

      if (fetchErr) { set.status = 500; return { error: fetchErr.message } }

      if (SYS_CF_ACCOUNT_ID && SYS_CF_API_KEY) {
        await Promise.allSettled(
          (images ?? []).map(async (rawImg: unknown) => {
            const img = rawImg as ImageRow
            if (img.cf_image_id) {
              await deleteFromCF(SYS_CF_ACCOUNT_ID, SYS_CF_API_KEY, img.cf_image_id)
            }
          })
        )
      }

      const { error: dbErr } = await db!.from('images').delete().in('id', ids)
      if (dbErr) { set.status = 500; return { error: dbErr.message } }
      return { success: true, deleted_count: ids.length }
    },
    {
      body: t.Object({
        ids: t.Array(t.String(), { minItems: 1 }),
      }),
    }
  )
