'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Centralized client-side auth hook.
 *
 * Fetches user and org data from /api/auth/me on mount (server reads the
 * httpOnly auth-token cookie automatically). Provides a stable reference and
 * handles logout + redirect logic in one place.
 *
 * Usage:
 *   const { token, orgId, user, org, isReady, logout } = useAuth()
 *
 * Note: `token` is always null — the JWT is stored in an httpOnly cookie and
 * is not accessible to JavaScript. Code that previously used `state.token` for
 * API calls should use `credentials: 'include'` instead (handled by fetchApi).
 */

export interface AuthUser {
  name: string
  email: string
  avatar: string | null
  team: string | null
  schoolScope: string | null
  role: string | null
  /** Controls which panel the dashboard renders: 'admin'|'maintenance'|'it'|'av'|'default' */
  dashboardMode: string
}

export interface AuthOrg {
  id: string
  name: string
  schoolType: string | null
  logoUrl: string | null
}

export interface AuthState {
  token: string | null
  orgId: string | null
  user: AuthUser
  org: AuthOrg
  /** True once the first /api/auth/me fetch has completed (success or failure) */
  isReady: boolean
  /** True if the user has admin/super role */
  isAdmin: boolean
  logout: () => Promise<void>
}

const LEGACY_KEYS = [
  'auth-token',
  'org-id',
  'user-name',
  'user-email',
  'user-avatar',
  'user-team',
  'user-school-scope',
  'user-role',
  'org-name',
  'org-school-type',
  'org-logo-url',
] as const

const DEFAULT_USER: AuthUser = {
  name: 'User',
  email: '',
  avatar: null,
  team: null,
  schoolScope: null,
  role: null,
  dashboardMode: 'default',
}

const DEFAULT_ORG: AuthOrg = {
  id: '',
  name: 'School',
  schoolType: null,
  logoUrl: null,
}

export function useAuth({ redirectTo = '/login' }: { redirectTo?: string } = {}): AuthState {
  const router = useRouter()

  // Hydrate from localStorage immediately (AuthBridge populates this on app load)
  const [user, setUser] = useState<AuthUser>(() => {
    if (typeof window === 'undefined') return DEFAULT_USER
    const name = localStorage.getItem('user-name')
    if (!name) return DEFAULT_USER
    return {
      name,
      email: localStorage.getItem('user-email') || '',
      avatar: localStorage.getItem('user-avatar') || null,
      team: localStorage.getItem('user-team') || null,
      schoolScope: localStorage.getItem('user-school-scope') || null,
      role: localStorage.getItem('user-role') || null,
      dashboardMode: localStorage.getItem('dashboard-mode') || 'default',
    }
  })
  const [org, setOrg] = useState<AuthOrg>(() => {
    if (typeof window === 'undefined') return DEFAULT_ORG
    const id = localStorage.getItem('org-id')
    if (!id) return DEFAULT_ORG
    return {
      id,
      name: localStorage.getItem('org-name') || 'School',
      schoolType: localStorage.getItem('org-school-type') || null,
      logoUrl: localStorage.getItem('org-logo-url') || null,
    }
  })
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window === 'undefined') return false
    return !!localStorage.getItem('auth-token') && !!localStorage.getItem('org-id')
  })
  const [isReady, setIsReady] = useState(() => {
    // If localStorage already has auth data (from AuthBridge), we're ready immediately
    if (typeof window === 'undefined') return false
    return !!localStorage.getItem('auth-token') && !!localStorage.getItem('org-id')
  })

  // Background refresh from server (keeps data fresh, handles session expiry)
  useEffect(() => {
    let cancelled = false

    fetch('/api/auth/me', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Not authenticated')
        return res.json()
      })
      .then((json) => {
        if (cancelled) return
        if (!json.ok) throw new Error('Not authenticated')
        setUser(json.data.user)
        setOrg(json.data.org)
        setIsAuthenticated(true)
        setIsReady(true)
      })
      .catch(() => {
        if (cancelled) return
        setIsAuthenticated(false)
        setIsReady(true)
        if (redirectTo) router.push(redirectTo)
      })

    return () => {
      cancelled = true
    }
  }, [redirectTo, router])

  // Listen for avatar & profile updates dispatched by other components
  useEffect(() => {
    const handleAvatarUpdate = (e: Event) => {
      const event = e as CustomEvent
      if (event.detail?.avatar !== undefined) {
        setUser((prev) => ({ ...prev, avatar: event.detail.avatar }))
      }
    }
    const handleProfileUpdate = (e: Event) => {
      const event = e as CustomEvent
      if (event.detail?.name) {
        setUser((prev) => ({ ...prev, name: event.detail.name }))
      }
    }

    window.addEventListener('avatar-updated', handleAvatarUpdate)
    window.addEventListener('profile-updated', handleProfileUpdate)
    return () => {
      window.removeEventListener('avatar-updated', handleAvatarUpdate)
      window.removeEventListener('profile-updated', handleProfileUpdate)
    }
  }, [])

  const logout = useCallback(async () => {
    // Tell server to clear the httpOnly cookie
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    // Clean up any legacy localStorage data from the old auth pattern
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k))
    router.push('/login')
  }, [router])

  const isAdmin = useMemo(() => {
    const role = (user.role || '').toLowerCase()
    return role.includes('admin') || role.includes('super')
  }, [user.role])

  return {
    token: null, // JWT is in httpOnly cookie — not accessible to JS
    orgId: isAuthenticated ? org.id || null : null,
    user,
    org,
    isReady,
    isAdmin,
    logout,
  }
}

export default useAuth
