import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Shield, Loader2, RefreshCw, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/lib/auth-store'
import { adminApi } from '@/lib/api'
import type { ApprovalUser } from '@/lib/api'
import { formatDate } from '@/lib/utils'

const ADMIN_EMAIL = 'rinezpz@gmail.com'

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
  return (
    <Badge variant="destructive">
      Rejected
    </Badge>
  )
}

export function Admin() {
  const user = useAuthStore((s) => s.user)
  const [users, setUsers] = useState<ApprovalUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Guard: only admin can access
  if (!user || user.email !== ADMIN_EMAIL) {
    return <Navigate to="/" replace />
  }

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

  useEffect(() => {
    fetchUsers()
  }, [])

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
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Manage user access requests
              {pendingCount > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  {pendingCount} pending
                </span>
              )}
            </p>
          </div>
        </div>
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
                  {/* Avatar */}
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

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{u.name ?? u.email}</p>
                    <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Requested {formatDate(u.created_at)}
                      {u.reviewed_at && ` · Reviewed ${formatDate(u.reviewed_at)}`}
                    </p>
                  </div>

                  {/* Status badge */}
                  <StatusBadge status={u.status} />

                  {/* Actions — only for pending */}
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
