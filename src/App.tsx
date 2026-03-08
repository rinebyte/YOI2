import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { Dashboard } from '@/pages/Dashboard'
import { Gallery } from '@/pages/Gallery'
import { Login } from '@/pages/Login'
import { AuthCallback } from '@/pages/AuthCallback'
import { PendingApproval } from '@/pages/PendingApproval'
import { Admin } from '@/pages/Admin'
import { useAuthStore } from '@/lib/auth-store'
import { useStore } from '@/lib/store'
import { accountsApi, ApiError } from '@/lib/api'
import { supabase } from '@/lib/supabase-client'

type ApprovalStatus = 'loading' | 'pending' | 'rejected' | 'ok'

// ── Keep auth store in sync with Supabase session ────────────────────
// This handles token refresh, tab-focus re-auth, and sign-out events
// that originate from the Supabase JS client.
function SupabaseAuthSync() {
  const { setAuth, clearAuth } = useAuthStore()
  const reset = useStore((s) => s.reset)

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN')) {
        setAuth(
          {
            id: session.user.id,
            email: session.user.email ?? '',
            name:
              (session.user.user_metadata?.full_name as string | null) ??
              (session.user.user_metadata?.name as string | null) ??
              null,
            avatar_url: (session.user.user_metadata?.avatar_url as string | null) ?? null,
            created_at: session.user.created_at,
          },
          {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at,
          }
        )
      }

      if (event === 'SIGNED_OUT') {
        clearAuth()
        reset()
      }
    })

    return () => subscription.unsubscribe()
  }, [setAuth, clearAuth, reset])

  return null
}

// ── Load the user's single account from API ──────────────────────────
function AccountSync({ onStatusChange }: { onStatusChange: (s: ApprovalStatus) => void }) {
  const session = useAuthStore((s) => s.session)
  const user = useAuthStore((s) => s.user)
  const syncAccounts = useStore((s) => s.syncAccounts)

  useEffect(() => {
    if (!session?.access_token) return

    onStatusChange('loading')
    accountsApi
      .me()
      .then((account) => {
        syncAccounts([account])
        onStatusChange('ok')
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          if (err.message === 'pending_approval') {
            onStatusChange('pending')
          } else if (err.message === 'rejected') {
            onStatusChange('rejected')
          } else {
            onStatusChange('ok')
          }
        } else {
          console.error(err)
          onStatusChange('ok')
        }
      })
  }, [session?.access_token, user?.email, syncAccounts, onStatusChange])

  return null
}

// ── Protected layout ─────────────────────────────────────────────────
function AppLayout({ approvalStatus }: { approvalStatus: ApprovalStatus }) {
  const session = useAuthStore((s) => s.session)
  const location = useLocation()

  if (!session?.access_token) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Show pending/rejected screen instead of normal layout (no sidebar)
  if (approvalStatus === 'pending' || approvalStatus === 'rejected') {
    return <PendingApproval status={approvalStatus} />
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}

// ── Redirect already-authenticated users away from /login ─────────────
function PublicRoute({ children }: { children: React.ReactNode }) {
  const session = useAuthStore((s) => s.session)
  if (session?.access_token) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>('loading')

  return (
    <BrowserRouter>
      <SupabaseAuthSync />
      <AccountSync onStatusChange={setApprovalStatus} />
      <Routes>
        {/* OAuth callback — must be public, no auth required */}
        <Route path="/auth/callback" element={<AuthCallback />} />

        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />

        <Route element={<AppLayout approvalStatus={approvalStatus} />}>
          <Route index element={<Dashboard />} />
          <Route path="gallery" element={<Gallery />} />
          <Route path="admin" element={<Admin />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
