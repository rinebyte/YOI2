-- ======================================================
-- CF Image Dashboard — Supabase Schema
-- Run this in the Supabase SQL editor
-- ======================================================

-- ======================================================
-- 1. ACCOUNTS
-- Each user can have multiple CF Image accounts (isolates
-- credentials, storage quotas, and image data)
-- ======================================================
CREATE TABLE IF NOT EXISTS public.accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  color           TEXT NOT NULL DEFAULT '#6366f1',
  cf_account_id   TEXT,            -- Cloudflare account ID
  cf_api_key      TEXT,            -- Cloudflare API token (Images:Edit)
  cf_images_hash  TEXT,            -- Cloudflare Images account hash (for delivery URLs)
  storage_limit   BIGINT NOT NULL DEFAULT 1073741824,  -- 1 GB
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- Users can only access their own accounts
CREATE POLICY "accounts_isolation" ON public.accounts
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ======================================================
-- 2. IMAGES
-- Fully scoped to an account; cascades on account delete
-- ======================================================
CREATE TABLE IF NOT EXISTS public.images (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cf_image_id     TEXT,            -- Cloudflare Images ID (for deletion)
  filename        TEXT NOT NULL,
  url             TEXT NOT NULL,   -- Full delivery URL
  thumbnail_url   TEXT NOT NULL,   -- Thumbnail variant URL
  size            BIGINT NOT NULL DEFAULT 0,
  width           INTEGER NOT NULL DEFAULT 0,
  height          INTEGER NOT NULL DEFAULT 0,
  mime_type       TEXT NOT NULL DEFAULT 'image/jpeg',
  tags            TEXT[] NOT NULL DEFAULT '{}',
  is_public       BOOLEAN NOT NULL DEFAULT true,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_images_account_id  ON public.images(account_id);
CREATE INDEX IF NOT EXISTS idx_images_user_id     ON public.images(user_id);
CREATE INDEX IF NOT EXISTS idx_images_uploaded_at ON public.images(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_tags        ON public.images USING gin(tags);

ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;

-- Images are scoped to the authenticated user
CREATE POLICY "images_isolation" ON public.images
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ======================================================
-- 3. STORAGE AGGREGATION VIEW
-- Computes per-account usage; inherits RLS from images
-- ======================================================
CREATE OR REPLACE VIEW public.account_storage
  WITH (security_invoker = true)
AS
SELECT
  account_id,
  COUNT(*)::BIGINT          AS image_count,
  COALESCE(SUM(size), 0)::BIGINT AS storage_used
FROM public.images
GROUP BY account_id;

-- ======================================================
-- 4. HELPER FUNCTION — soft storage check
-- Returns true if account has headroom for `bytes`
-- ======================================================
CREATE OR REPLACE FUNCTION public.account_has_storage(p_account_id UUID, p_bytes BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    COALESCE(SUM(i.size), 0) + p_bytes <= a.storage_limit
  FROM public.accounts a
  LEFT JOIN public.images i ON i.account_id = a.id
  WHERE a.id = p_account_id
    AND a.user_id = auth.uid()
  GROUP BY a.storage_limit;
$$;
