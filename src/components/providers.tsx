'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect, useRef } from 'react'
import { usePrefetchOnAuth } from '@/lib/hooks/usePrefetchOnAuth'
import { ToastProvider } from '@/components/Toast'
import dynamic from 'next/dynamic'

// Lazy-load the AI chat button so it doesn't impact initial bundle size
const ChatButton = dynamic(() => import('@/components/ai/ChatButton'), {
  ssr: false,
})

// ── Paths that don't need auth hydration ────────────────────────────
const PUBLIC_PREFIXES = [
  '/login', '/set-password', '/reset-password', '/signup',
  '/verify-email', '/it/sub', '/it/password-reset', '/it/ticket-status',
  '/athletics/public', '/pricing', '/about',
]

function isPublicPage(): boolean {
  if (typeof window === 'undefined') return false
  const path = window.location.pathname
  return path === '/' || PUBLIC_PREFIXES.some((p) => path.startsWith(p))
}

// ── CSRF Interceptor ────────────────────────────────────────────────
// Old pages use raw fetch() without the CSRF header. Install a global
// interceptor that reads the csrf-token cookie and adds the header
// automatically on state-changing requests.

interface WindowWithCsrf extends Window {
  __csrfInterceptorInstalled?: boolean
}

function installCsrfInterceptor() {
  if (typeof window === 'undefined') return
  const win = window as WindowWithCsrf
  // Only install once
  if (win.__csrfInterceptorInstalled) return
  win.__csrfInterceptorInstalled = true

  const originalFetch = window.fetch.bind(window)

  window.fetch = async function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    // Only add CSRF for same-origin mutating requests
    const method = (init?.method || 'GET').toUpperCase()
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url
      const isSameOrigin =
        url.startsWith('/') || url.startsWith(window.location.origin)

      if (isSameOrigin) {
        const csrfMatch = document.cookie
          .split(';')
          .find((c) => c.trim().startsWith('csrf-token='))
        const csrfToken = csrfMatch
          ? csrfMatch.trim().slice('csrf-token='.length)
          : null

        if (csrfToken) {
          const headers = new Headers(init?.headers)
          if (!headers.has('X-CSRF-Token')) {
            headers.set('X-CSRF-Token', csrfToken)
          }
          init = { ...init, headers }
        }
      }
    }

    return originalFetch(input, init)
  }
}

// ── Auth Bridge ─────────────────────────────────────────────────────
// Fetches /api/auth/me (reads httpOnly cookie) and populates localStorage
// so all existing pages keep working with zero changes. Blocks rendering
// of children on auth-required pages until the check completes.
function AuthBridge({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    // Install CSRF interceptor on first load
    installCsrfInterceptor()

    // Public pages don't need to wait for auth hydration
    if (isPublicPage()) {
      setReady(true)
      return
    }

    // If localStorage already has auth data, render immediately
    // (the cookie check will still run to keep it fresh)
    const hasLocalAuth = localStorage.getItem('auth-token') && localStorage.getItem('org-id')
    if (hasLocalAuth) {
      setReady(true)
    }

    // Hydrate from cookie → localStorage
    fetch('/api/auth/me', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Not authenticated')
        return res.json()
      })
      .then((json) => {
        if (!json.ok) throw new Error('Not authenticated')
        const { user, org, isImpersonating, adminName } = json.data

        // Bridge: populate localStorage for backward compat with all existing pages
        localStorage.setItem('auth-token', 'cookie-auth') // sentinel — real JWT is in httpOnly cookie
        localStorage.setItem('org-id', org.id)
        localStorage.setItem('user-id', user.id || '')
        localStorage.setItem('user-name', user.name || '')
        localStorage.setItem('user-email', user.email || '')
        localStorage.setItem('user-avatar', user.avatar || '')
        localStorage.setItem('user-team', user.team || '')
        localStorage.setItem('user-team-slugs', JSON.stringify(user.teamSlugs || []))
        localStorage.setItem('user-school-scope', user.schoolScope || '')
        localStorage.setItem('user-role', user.role || '')
        localStorage.setItem('org-name', org.name || '')
        localStorage.setItem('org-school-type', org.schoolType || '')
        localStorage.setItem('org-logo-url', org.logoUrl || '')
        localStorage.setItem('dashboard-mode', user.dashboardMode || 'default')

        // Prefetch modules for instant add-on rendering
        fetch('/api/modules', { credentials: 'include' })
          .then((res) => res.json())
          .then((json) => {
            if (json.ok && Array.isArray(json.data)) {
              localStorage.setItem('cached-modules', JSON.stringify(json.data))
            }
          })
          .catch(() => {})

        // Impersonation state
        if (isImpersonating) {
          localStorage.setItem('is-impersonating', 'true')
          localStorage.setItem('admin-name', adminName || '')
        } else {
          localStorage.removeItem('is-impersonating')
          localStorage.removeItem('admin-name')
        }

        setReady(true)
      })
      .catch(() => {
        // Not authenticated — clear any stale localStorage data
        ;[
          'auth-token', 'org-id', 'user-name', 'user-email', 'user-avatar',
          'user-team', 'user-school-scope', 'user-role', 'org-name',
          'org-school-type', 'org-logo-url', 'dashboard-mode', 'is-impersonating', 'admin-name',
        ].forEach((k) => localStorage.removeItem(k))
        setReady(true)
        // Individual pages will see empty localStorage and redirect to /login
      })
  }, [])

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" />
      </div>
    )
  }

  return <>{children}</>
}

// Paths where the floating Leo chat button should NOT render — onboarding
// funnel in particular needs to stay focused (no chat distraction while
// the user is trying to set up their school).
const CHAT_HIDDEN_PREFIXES = ['/onboarding', '/login', '/signup', '/set-password', '/reset-password', '/verify-email']

function shouldHideChat(pathname: string | null): boolean {
  if (!pathname) return false
  return CHAT_HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))
}

function PrefetchGate({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [pathname, setPathname] = useState<string | null>(null)

  useEffect(() => {
    setToken(localStorage.getItem('auth-token'))
    setPathname(window.location.pathname)

    // Track client-side nav so the chat button hides/shows when routing
    // through onboarding ↔ dashboard without a full reload.
    const onNav = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', onNav)
    return () => window.removeEventListener('popstate', onNav)
  }, [])

  // Warm the TanStack Query cache as soon as we know the user is authed
  usePrefetchOnAuth(token)

  const hideChat = shouldHideChat(pathname)

  return (
    <>
      {children}
      {/* Leo floating chat button removed — chat is now per-event via PresenceBar */}
    </>
  )
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 30 * 60 * 1000,
            refetchOnWindowFocus: false,
            refetchOnMount: false,
            retry: 1,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthBridge>
          <PrefetchGate>{children}</PrefetchGate>
        </AuthBridge>
      </ToastProvider>
    </QueryClientProvider>
  )
}
