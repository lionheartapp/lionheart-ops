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
  id: string | null
  name: string
  email: string
  avatar: string | null
  team: string | null
  /** Grade-level division the user is pinned to (ELEMENTARY | MIDDLE_SCHOOL | HIGH_SCHOOL). Null = org-wide. */
  campusScope: string | null
  /** @deprecated Phase 1c — use campusScope. Kept as an alias during migration. */
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
  'user-school-scope', // legacy key — kept for cleanup on logout
  'user-campus-scope',
  'user-role',
  'org-name',
  'org-school-type',
  'org-logo-url',
] as const

const DEFAULT_USER: AuthUser = {
  id: null,
  name: 'User',
  email: '',
  avatar: null,
  team: null,
  campusScope: null,
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

/**
 * LIVE-002: request coalescing for /api/auth/me.
 *
 * Without this, every component that calls useAuth (or anywhere else that
 * fires /api/auth/me) starts its own network round-trip. On the Settings page
 * the dashboard layout, the page itself, and several embedded components all
 * end up calling /me at roughly the same instant — we observed 5 simultaneous
 * requests on a single page load (some from React StrictMode in dev, the rest
 * from genuine duplicate consumers).
 *
 * `inFlightMe` holds the currently-in-flight promise so concurrent callers
 * share the same fetch. Once the response resolves the in-flight ref is
 * cleared, so a future call (e.g. after a navigation) does a fresh fetch.
 *
 * Note for production: React StrictMode double-invokes effects in development
 * only — production won't see the 2x amplification, but the same coalescing
 * still helps multiple components mount in the same tick.
 */
type AuthMeResponse = { ok: boolean; data?: { user: AuthUser; org: AuthOrg }; error?: unknown }
let inFlightMe: Promise<AuthMeResponse> | null = null

function fetchAuthMeShared(): Promise<AuthMeResponse> {
  if (inFlightMe) return inFlightMe
  inFlightMe = fetch('/api/auth/me', { credentials: 'include' })
    .then(async (res): Promise<AuthMeResponse> => {
      if (!res.ok) return { ok: false, error: { status: res.status } }
      const json = await res.json().catch(() => null)
      return (json as AuthMeResponse) ?? { ok: false }
    })
    .catch((err): AuthMeResponse => ({ ok: false, error: err }))
    .finally(() => {
      // Clear once resolved so future mounts can re-fetch.
      inFlightMe = null
    })
  return inFlightMe
}

export function useAuth({ redirectTo = '/login' }: { redirectTo?: string } = {}): AuthState {
  const router = useRouter()

  // Hydrate from localStorage immediately (AuthBridge populates this on app load)
  const [user, setUser] = useState<AuthUser>(() => {
    if (typeof window === 'undefined') return DEFAULT_USER
    const name = localStorage.getItem('user-name')
    if (!name) return DEFAULT_USER
    // Prefer the new `user-campus-scope` key but fall back to the legacy
    // `user-school-scope` so sessions started before the rename keep working.
    const campusScope =
      localStorage.getItem('user-campus-scope') ||
      localStorage.getItem('user-school-scope') ||
      null
    return {
      id: localStorage.getItem('user-id') || null,
      name,
      email: localStorage.getItem('user-email') || '',
      avatar: localStorage.getItem('user-avatar') || null,
      team: localStorage.getItem('user-team') || null,
      campusScope,
      // Deprecated alias — kept in sync with campusScope during the migration
      schoolScope: campusScope,
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

  // Background refresh from server (keeps data fresh, handles session expiry).
  // LIVE-002: routes through fetchAuthMeShared() so multiple useAuth consumers
  // mounting in the same tick share a single network round-trip.
  useEffect(() => {
    let cancelled = false

    fetchAuthMeShared()
      .then((json) => {
        if (cancelled) return
        if (!json.ok || !json.data) {
          setIsAuthenticated(false)
          setIsReady(true)
          if (redirectTo) router.push(redirectTo)
          return
        }
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
