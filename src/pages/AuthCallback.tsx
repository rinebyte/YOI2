import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase-client'
import { useAuthStore } from '@/lib/auth-store'
import type { Session } from '@supabase/supabase-js'

export function AuthCallback() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const done = useRef(false)

  function applySession(session: Session) {
    if (done.current) return
    done.current = true
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
    navigate('/', { replace: true })
  }

  useEffect(() => {
    // 1. Try immediately — Supabase may have already exchanged the PKCE code
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        applySession(session)
        return
      }

      // 2. Code exchange is still in progress — listen for SIGNED_IN.
      //    Do NOT navigate to /login on INITIAL_SESSION(null); that event
      //    fires before the exchange completes and is expected to be empty.
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          applySession(session)
          subscription.unsubscribe()
        }
        // Ignore INITIAL_SESSION with null — it arrives before PKCE exchange
      })

      // 3. Hard timeout — if nothing resolves in 10 s, bail to login
      const timer = setTimeout(() => {
        if (done.current) return
        subscription.unsubscribe()
        navigate('/login', { replace: true })
      }, 10_000)

      return () => {
        subscription.unsubscribe()
        clearTimeout(timer)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-muted/30">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Completing sign-in…</p>
    </div>
  )
}
