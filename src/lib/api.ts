import { useAuthStore, getAccessToken } from './auth-store'
import { supabase } from './supabase-client'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

// ──────────────────────────────────────────────────────────────────────
// Core fetch wrapper
// ──────────────────────────────────────────────────────────────────────
async function req<T>(
  path: string,
  options: RequestInit = {},
  isFormData = false
): Promise<T> {
  const token = getAccessToken()

  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string> | undefined),
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers })

  // Token expired — attempt refresh
  if (res.status === 401) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      return req<T>(path, options, isFormData)
    }
    useAuthStore.getState().clearAuth()
    window.location.href = '/login'
    throw new Error('Session expired')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new ApiError(body.error ?? 'Request failed', res.status)
  }

  return res.json() as Promise<T>
}

async function tryRefresh(): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.refreshSession()
    if (error || !data.session) return false
    useAuthStore.getState().updateSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    })
    return true
  } catch {
    return false
  }
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// ──────────────────────────────────────────────────────────────────────
// Types (mirrors server/src/types.ts)
// ──────────────────────────────────────────────────────────────────────
export interface ApiAccount {
  id: string
  user_id: string
  name: string
  email: string
  color: string
  cf_account_id: string | null
  cf_images_hash: string | null
  storage_limit: number
  created_at: string
  account_storage?: { image_count: number; storage_used: number } | null
}

export interface ApiImage {
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

export interface Paginated<T> {
  data: T[]
  pagination: { page: number; limit: number; total: number; total_pages: number }
}

export interface ApprovalUser {
  id: string
  user_id: string
  email: string
  name: string | null
  avatar_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  reviewed_at: string | null
}

// ──────────────────────────────────────────────────────────────────────
// Auth API
// Login/register happen client-side via Supabase Google OAuth.
// The backend only needs /me (profile) and /logout (token revocation).
// ──────────────────────────────────────────────────────────────────────
export const authApi = {
  logout: () => req<{ success: boolean }>('/auth/logout', { method: 'POST' }),
  me: () => req<import('./auth-store').AuthUser>('/auth/me'),
}

// ──────────────────────────────────────────────────────────────────────
// Accounts API
// ──────────────────────────────────────────────────────────────────────
export const accountsApi = {
  me: () => req<ApiAccount>('/accounts/me'),

  list: () => req<ApiAccount[]>('/accounts'),

  get: (id: string) => req<ApiAccount>(`/accounts/${id}`),

  create: (data: {
    name: string
    email: string
    color?: string
    storage_limit?: number
  }) => req<ApiAccount>('/accounts', { method: 'POST', body: JSON.stringify(data) }),

  update: (
    id: string,
    data: {
      name?: string
      email?: string
      color?: string
      storage_limit?: number
    }
  ) => req<ApiAccount>(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string) => req<{ success: boolean }>(`/accounts/${id}`, { method: 'DELETE' }),
}

// ──────────────────────────────────────────────────────────────────────
// Admin API
// ──────────────────────────────────────────────────────────────────────
export const adminApi = {
  listUsers: () => req<ApprovalUser[]>('/admin/users'),
  approve: (userId: string) => req<ApprovalUser>(`/admin/users/${userId}/approve`, { method: 'POST' }),
  reject: (userId: string) => req<ApprovalUser>(`/admin/users/${userId}/reject`, { method: 'POST' }),

  listImages: (params?: { page?: number; limit?: number; search?: string; user_id?: string }) => {
    const q = new URLSearchParams()
    if (params?.page)    q.set('page', String(params.page))
    if (params?.limit)   q.set('limit', String(params.limit))
    if (params?.search)  q.set('search', params.search)
    if (params?.user_id) q.set('user_id', params.user_id)
    return req<Paginated<ApiImage>>(`/admin/images?${q.toString()}`)
  },

  deleteImage: (id: string) =>
    req<{ success: boolean; deleted_id: string }>(`/admin/images/${id}`, { method: 'DELETE' }),

  deleteImagesBulk: (ids: string[]) =>
    req<{ success: boolean; deleted_count: number }>('/admin/images/bulk', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    }),
}

// ──────────────────────────────────────────────────────────────────────
// Images API
// ──────────────────────────────────────────────────────────────────────
export const imagesApi = {
  list: (params: {
    account_id: string
    page?: number
    limit?: number
    search?: string
    tags?: string
    is_public?: boolean
  }) => {
    const q = new URLSearchParams()
    q.set('account_id', params.account_id)
    if (params.page)      q.set('page', String(params.page))
    if (params.limit)     q.set('limit', String(params.limit))
    if (params.search)    q.set('search', params.search)
    if (params.tags)      q.set('tags', params.tags)
    if (params.is_public !== undefined) q.set('is_public', String(params.is_public))
    return req<Paginated<ApiImage>>(`/images?${q.toString()}`)
  },

  get: (id: string) => req<ApiImage>(`/images/${id}`),

  upload: (
    accountId: string,
    file: File,
    options: { tags?: string[]; isPublic?: boolean } = {}
  ) => {
    const form = new FormData()
    form.append('file', file)
    form.append('account_id', accountId)
    if (options.tags?.length) form.append('tags', JSON.stringify(options.tags))
    if (options.isPublic !== undefined) form.append('is_public', String(options.isPublic))
    return req<ApiImage>('/images/upload', { method: 'POST', body: form }, true)
  },

  update: (id: string, data: { tags?: string[]; is_public?: boolean; filename?: string }) =>
    req<ApiImage>(`/images/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) =>
    req<{ success: boolean }>(`/images/${id}`, { method: 'DELETE' }),

  deleteBulk: (ids: string[]) =>
    req<{ success: boolean; deleted_count: number }>('/images/bulk', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    }),
}
