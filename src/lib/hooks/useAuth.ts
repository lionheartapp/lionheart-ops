'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Centralized client-side auth hook.
 *
 * Reads auth / user / org data from localStorage once, provides a stable
 * reference, and handles logout + redirect logic in one place.
 *
 * Usage:
 *   const { token, orgId, user, org, isReady, logout } = useAuth()
 */

export interface AuthUser {
  name: string
  email: string
  avatar: string | null
  team: string | null
  schoolScope: string | null
  role: string | null
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
  /** True once the first client-side read has completed */
  isReady: boolean
  /** True if the user has admin/super role (optimistic from localStorage) */
  isAdmin: boolean
  logout: () => void
}

const AUTH_KEYS = [
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

function readFromStorage(): {
  token: string | null
  orgId: string | null
  user: AuthUser
  org: AuthOrg
} {
  if (typeof window === 'undefined') {
    return {
      token: null,
      orgId: null,
      user: { name: 'User', email: '', avatar: null, team: null, schoolScope: null, role: null },
      org: { id: '', name: 'School', schoolType: null, logoUrl: null },
    }
  }

  const token = localStorage.getItem('auth-token')
  const orgId = localStorage.getItem('org-id')

  return {
    token,
    orgId,
    user: {
      name: localStorage.getItem('user-name') || 'User',
      email: localStorage.getItem('user-email') || '',
      avatar: localStorage.getItem('user-avatar') || null,
      team: localStorage.getItem('user-team') || null,
      schoolScope: localStorage.getItem('user-school-scope') || null,
      role: localStorage.getItem('user-role') || null,
    },
    org: {
      id: orgId || '',
      name: localStorage.getItem('org-name') || 'School',
      schoolType: localStorage.getItem('org-school-type') || null,
      logoUrl: localStorage.getItem('org-logo-url') || null,
    },
  }
}

export function useAuth({ redirectTo = '/login' }: { redirectTo?: string } = {}): AuthState {
  const router = useRouter()
  const [isReady, setIsReady] = useState(false)
  const [state, setState] = useState(readFromStorage)

  // Read from localStorage on client mount
  useEffect(() => {
    setState(readFromStorage())
    setIsReady(true)
  }, [])

  // Redirect if not authenticated
  useEffect(() => {
    if (isReady && (!state.token || !state.orgId) && redirectTo) {
      router.push(redirectTo)
    }
  }, [isReady, state.token, state.orgId, redirectTo, router])

  // Listen for avatar & profile updates from other components
  useEffect(() => {
    const handleAvatarUpdate = (e: Event) => {
      const event = e as CustomEvent
      if (event.detail?.avatar !== undefined) {
        setState((prev) => ({
          ...prev,
          user: { ...prev.user, avatar: event.detail.avatar },
        }))
      }
    }
    const handleProfileUpdate = (e: Event) => {
      const event = e as CustomEvent
      if (event.detail?.name) {
        setState((prev) => ({
          ...prev,
          user: { ...prev.user, name: event.detail.name },
        }))
      }
    }

    window.addEventListener('avatar-updated', handleAvatarUpdate)
    window.addEventListener('profile-updated', handleProfileUpdate)
    return () => {
      window.removeEventListener('avatar-updated', handleAvatarUpdate)
      window.removeEventListener('profile-updated', handleProfileUpdate)
    }
  }, [])

  const logout = useCallback(() => {
    AUTH_KEYS.forEach((key) => localStorage.removeItem(key))
    router.push('/login')
  }, [router])

  const isAdmin = useMemo(() => {
    const role = (state.user.role || '').toLowerCase()
    return role.includes('admin') || role.includes('super')
  }, [state.user.role])

  return { ...state, isReady, isAdmin, logout }
}

export default useAuth
