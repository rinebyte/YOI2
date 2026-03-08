import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AuthUser {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  created_at?: string
}

export interface AuthSession {
  access_token: string
  refresh_token: string
  expires_at?: number
}

interface AuthState {
  user: AuthUser | null
  session: AuthSession | null
  isLoading: boolean

  setAuth: (user: AuthUser, session: AuthSession) => void
  clearAuth: () => void
  setLoading: (v: boolean) => void
  updateSession: (session: AuthSession) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      isLoading: false,

      setAuth: (user, session) => set({ user, session }),
      clearAuth: () => set({ user: null, session: null }),
      setLoading: (isLoading) => set({ isLoading }),
      updateSession: (session) => set({ session }),
    }),
    {
      name: 'cf-image-auth',
      partialize: (s) => ({ user: s.user, session: s.session }),
    }
  )
)

export const isAuthenticated = () => !!useAuthStore.getState().session?.access_token
export const getAccessToken  = () => useAuthStore.getState().session?.access_token ?? null
