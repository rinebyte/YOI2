import type { User } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

// Re-export so routes don't import from supabase directly
export type { User }

export interface AuthContext {
  user: User
  token: string
  db: SupabaseClient
}

// ──────────────────────────────────────────────
// DB row shapes (mirror the Supabase schema)
// ──────────────────────────────────────────────
export interface AccountRow {
  id: string
  user_id: string
  name: string
  email: string
  color: string
  cf_account_id: string | null
  cf_api_key: string | null
  cf_images_hash: string | null
  storage_limit: number
  created_at: string
}

export interface ImageRow {
  id: string
  account_id: string
  user_id: string
  cf_image_id: string | null
  filename: string
  url: string
  thumbnail_url: string
  size: number
  width: number
  height: number
  mime_type: string
  tags: string[]
  is_public: boolean
  uploaded_at: string
}

// ──────────────────────────────────────────────
// Cloudflare Images API shapes
// ──────────────────────────────────────────────
export interface CfUploadResponse {
  result: {
    id: string
    filename: string
    uploaded: string
    requireSignedURLs: boolean
    variants: string[]
    meta?: Record<string, string>
  }
  success: boolean
  errors: Array<{ code: number; message: string }>
  messages: unknown[]
}

export interface CfDeleteResponse {
  result: Record<string, never>
  success: boolean
  errors: Array<{ code: number; message: string }>
}

// ──────────────────────────────────────────────
// API response types (sent to the frontend)
// ──────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
  }
}

export interface ErrorResponse {
  error: string
  code?: string
}
