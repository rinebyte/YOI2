import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Shield, Loader2, RefreshCw, Check, X, Trash2,
  Images, Users, Search, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/lib/auth-store'
import { adminApi } from '@/lib/api'
import type { ApprovalUser, ApiImage } from '@/lib/api'
import { formatDate, formatBytes } from '@/lib/utils'

const ADMIN_EMAIL = 'rinezpz@gmail.com'

// ── Status badge ────────────────────────────────────────────────────
function StatusBadge({ status }: { status: ApprovalUser['status'] }) {
  if (status === 'pending') {
    return (
      <Badge className="border-transparent bg-amber-100 text-amber-800 hover:bg-amber-100">
        Pending
      </Badge>
    )
  }
  if (status === 'approved') {
    return (
      <Badge className="border-transparent bg-green-100 text-green-800 hover:bg-green-100">
        Approved
      </Badge>
    )
  }
  return <Badge variant="destructive">Rejected</Badge>
}

// ── Users tab ────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState<ApprovalUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminApi.listUsers()
      setUsers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const handleApprove = async (userId: string) => {
    setActionLoading(userId + ':approve')
    try {
      const updated = await adminApi.approve(userId)
      setUsers((prev) => prev.map((u) => (u.user_id === userId ? updated : u)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve user')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (userId: string) => {
    setActionLoading(userId + ':reject')
    try {
      const updated = await adminApi.reject(userId)
      setUsers((prev) => prev.map((u) => (u.user_id === userId ? updated : u)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject user')
    } finally {
      setActionLoading(null)
    }
  }

  const pendingCount = users.filter((u) => u.status === 'pending').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {users.length} total users
          {pendingCount > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {pendingCount} pending
            </span>
          )}
        </p>
        <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">User Approvals</CardTitle>
          <CardDescription>
            Users who have signed in and are awaiting access review.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center py-12 text-sm text-muted-foreground">
              No users have requested access yet.
            </p>
          ) : (
            <div className="divide-y">
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-4 py-3">
                  {u.avatar_url ? (
                    <img
                      src={u.avatar_url}
                      alt={u.name ?? u.email}
                      className="h-9 w-9 shrink-0 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {(u.name ?? u.email).charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{u.name ?? u.email}</p>
                    <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Requested {formatDate(u.created_at)}
                      {u.reviewed_at && ` · Reviewed ${formatDate(u.reviewed_at)}`}
                    </p>
                  </div>
                  <StatusBadge status={u.status} />
                  {u.status === 'pending' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-green-700 border-green-300 hover:bg-green-50 hover:text-green-800"
                        onClick={() => handleApprove(u.user_id)}
                        disabled={!!actionLoading}
                      >
                        {actionLoading === u.user_id + ':approve' ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => handleReject(u.user_id)}
                        disabled={!!actionLoading}
                      >
                        {actionLoading === u.user_id + ':reject' ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Images tab ───────────────────────────────────────────────────────
function ImagesTab() {
  const [images, setImages] = useState<ApiImage[]>([])
  const [users, setUsers] = useState<ApprovalUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterUserId, setFilterUserId] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState<string | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(null)

  const fetchImages = useCallback(async (p: number, s: string, uid: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminApi.listImages({
        page: p,
        limit: 50,
        search: s || undefined,
        user_id: uid || undefined,
      })
      setImages(res.data)
      setTotalPages(res.pagination.total_pages)
      setTotal(res.pagination.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load images')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    adminApi.listUsers().then(setUsers).catch(() => {})
  }, [])

  useEffect(() => {
    fetchImages(page, search, filterUserId)
  }, [page, filterUserId, fetchImages])

  // Debounce search
  const handleSearch = (val: string) => {
    setSearch(val)
    setPage(1)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      fetchImages(1, val, filterUserId)
    }, 400)
  }

  const handleFilterUser = (uid: string) => {
    setFilterUserId(uid)
    setPage(1)
    setSelected(new Set())
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === images.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(images.map((i) => i.id)))
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this image? This cannot be undone.')) return
    setDeleting(id)
    try {
      await adminApi.deleteImage(id)
      setImages((prev) => prev.filter((i) => i.id !== id))
      setSelected((prev) => { const s = new Set(prev); s.delete(id); return s })
      setTotal((t) => t - 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete image')
    } finally {
      setDeleting(null)
    }
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selected)
    if (!ids.length) return
    if (!confirm(`Delete ${ids.length} image(s)? This cannot be undone.`)) return
    setBulkDeleting(true)
    try {
      await adminApi.deleteImagesBulk(ids)
      setImages((prev) => prev.filter((i) => !selected.has(i.id)))
      setTotal((t) => t - ids.length)
      setSelected(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to bulk delete')
    } finally {
      setBulkDeleting(false)
    }
  }

  const getUserLabel = (userId: string) => {
    const u = users.find((u) => u.user_id === userId)
    return u ? (u.name ?? u.email) : userId.slice(0, 8) + '…'
  }

  const getUserAvatar = (userId: string) => {
    return users.find((u) => u.user_id === userId)?.avatar_url ?? null
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full rounded-md border bg-background pl-8 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            placeholder="Search filename…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        {/* Filter by user */}
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          value={filterUserId}
          onChange={(e) => handleFilterUser(e.target.value)}
        >
          <option value="">All users</option>
          {users.map((u) => (
            <option key={u.user_id} value={u.user_id}>
              {u.name ?? u.email}
            </option>
          ))}
        </select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchImages(page, search, filterUserId)}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>

        {selected.size > 0 && (
          <Button
            size="sm"
            variant="destructive"
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="gap-1.5"
          >
            {bulkDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete {selected.size} selected
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">All Images</CardTitle>
            <span className="text-sm text-muted-foreground">{total} total</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : images.length === 0 ? (
            <p className="text-center py-16 text-sm text-muted-foreground">No images found.</p>
          ) : (
            <>
              {/* Header row */}
              <div className="flex items-center gap-3 border-b px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <input
                  type="checkbox"
                  checked={selected.size === images.length && images.length > 0}
                  onChange={toggleAll}
                  className="rounded"
                />
                <span className="w-12 shrink-0">Preview</span>
                <span className="flex-1">Filename</span>
                <span className="w-36 hidden sm:block">Owner</span>
                <span className="w-20 hidden md:block text-right">Size</span>
                <span className="w-28 hidden lg:block">Uploaded</span>
                <span className="w-16 text-right">Actions</span>
              </div>

              <div className="divide-y">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                      selected.has(img.id) ? 'bg-muted/40' : 'hover:bg-muted/20'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(img.id)}
                      onChange={() => toggleSelect(img.id)}
                      className="rounded"
                    />

                    {/* Thumbnail */}
                    <div className="w-12 h-10 shrink-0 rounded overflow-hidden bg-muted">
                      <img
                        src={img.thumbnail_url}
                        alt={img.filename}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>

                    {/* Filename */}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{img.filename}</p>
                      <p className="text-xs text-muted-foreground">{img.mime_type}</p>
                    </div>

                    {/* Owner */}
                    <div className="w-36 hidden sm:flex items-center gap-1.5 min-w-0">
                      {getUserAvatar(img.user_id) ? (
                        <img
                          src={getUserAvatar(img.user_id)!}
                          className="h-5 w-5 rounded-full shrink-0 object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                          {getUserLabel(img.user_id).charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="truncate text-xs text-muted-foreground">
                        {getUserLabel(img.user_id)}
                      </span>
                    </div>

                    {/* Size */}
                    <span className="w-20 hidden md:block text-right text-xs text-muted-foreground">
                      {formatBytes(img.size)}
                    </span>

                    {/* Date */}
                    <span className="w-28 hidden lg:block text-xs text-muted-foreground">
                      {formatDate(img.uploaded_at)}
                    </span>

                    {/* Delete */}
                    <div className="w-16 flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(img.id)}
                        disabled={deleting === img.id || bulkDeleting}
                        title="Delete image"
                      >
                        {deleting === img.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <span className="text-xs text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 w-7 p-0"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 w-7 p-0"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Main Admin page ──────────────────────────────────────────────────
export function Admin() {
  const user = useAuthStore((s) => s.user)
  const [tab, setTab] = useState<'users' | 'images'>('users')

  if (!user || user.email !== ADMIN_EMAIL) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
          <Shield className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage users and their content</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setTab('users')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'users'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="h-4 w-4" />
          Users
        </button>
        <button
          onClick={() => setTab('images')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'images'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Images className="h-4 w-4" />
          Images
        </button>
      </div>

      {tab === 'users' ? <UsersTab /> : <ImagesTab />}
    </div>
  )
}
