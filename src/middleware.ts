import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthToken } from '@/lib/auth'
import { verifyPlatformAuthToken } from '@/lib/auth/platform-auth'
import { publicApiRateLimiter, signupRateLimiter, getRateLimitHeaders } from '@/lib/rate-limit'

const PUBLIC_PATHS = new Set(['/', '/login', '/set-password', '/signup', '/signin', '/app', '/dashboard', '/settings', '/verify-email'])
const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'platform', 'admin'])
const APEX_HOSTS = new Set(['lionheartapp.com', 'www.lionheartapp.com', 'localhost', '127.0.0.1'])

// Platform admin public paths (no auth required)
const PLATFORM_PUBLIC_PATHS = [
  '/api/platform/auth/login',
  '/api/platform/auth/setup',
  '/api/platform/webhooks/stripe',
]

function getSubdomainFromHost(host: string): string | null {
  const hostname = host.split(':')[0].toLowerCase()
  if (APEX_HOSTS.has(hostname)) return null
  const base = hostname.replace(/^www\./, '')

  if (base.endsWith('.localhost')) {
    const sub = base.replace(/\.localhost$/, '')
    return sub && !RESERVED_SUBDOMAINS.has(sub) ? sub : null
  }

  const parts = base.split('.')
  if (parts.length > 2) {
    const sub = parts[0]
    return sub && !RESERVED_SUBDOMAINS.has(sub) ? sub : null
  }

  return null
}

function isPlatformAdminHost(host: string): boolean {
  const hostname = host.split(':')[0].toLowerCase()
  return hostname === 'admin.lionheartapp.com' || hostname === 'admin.localhost'
}

function isPlatformPath(pathname: string): boolean {
  return pathname.startsWith('/api/platform/') || pathname.startsWith('/platform') || pathname.startsWith('/admin')
}

function isPlatformPublicPath(pathname: string): boolean {
  return PLATFORM_PUBLIC_PATHS.some(p => pathname.startsWith(p))
}

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true
  if (pathname.startsWith('/_next')) return true
  if (pathname.startsWith('/favicon')) return true
  if (pathname.startsWith('/api/auth/login')) return true
  if (pathname.startsWith('/api/auth/set-password')) return true
  if (pathname.startsWith('/api/auth/forgot-password')) return true
  if (pathname.startsWith('/api/auth/reset-password')) return true
  if (pathname.startsWith('/api/auth/verify-email')) return true
  if (pathname.startsWith('/api/auth/resend-verification')) return true
  // Auth.js (NextAuth) OAuth callback URLs — must remain public
  if (pathname.startsWith('/api/auth/callback/')) return true
  if (pathname.startsWith('/api/auth/signin')) return true
  if (pathname.startsWith('/api/auth/signout')) return true
  if (pathname.startsWith('/api/auth/session')) return true
  if (pathname.startsWith('/api/auth/csrf')) return true
  if (pathname.startsWith('/api/auth/providers')) return true
  // NOTE: /api/auth/me and /api/auth/logout are NOT public — they require auth cookie
  if (pathname.startsWith('/api/branding')) return true
  if (pathname.startsWith('/api/organizations/slug-check')) return true
  if (pathname.startsWith('/api/organizations/signup')) return true
  if (pathname.startsWith('/api/public/')) return true
  if (pathname === '/sw.js') return true
  if (pathname === '/manifest.json') return true
  if (pathname === '/offline') return true
  if (pathname.startsWith('/icons/')) return true
  if (pathname === '/it/sub') return true
  if (pathname === '/it/password-reset') return true
  if (pathname.startsWith('/api/it/magic-links/') && pathname.includes('/validate')) return true
  if (pathname === '/api/it/tickets/sub') return true
  if (pathname.startsWith('/api/webhooks/clever')) return true
  if (pathname.startsWith('/api/webhooks/classlink')) return true
  if (pathname.startsWith('/api/it/content-filters/webhook/')) return true
  if (pathname.startsWith('/api/cron/')) return true
  // Public ticket status check
  if (pathname === '/it/ticket-status') return true
  if (pathname.match(/^\/api\/it\/tickets\/[^/]+\/status-public$/)) return true
  // Device lookup via QR scan
  if (pathname === '/api/it/devices/lookup') return true
  // Student password self-service (public, no auth)
  if (pathname.startsWith('/api/it/student-password/lookup')) return true
  if (pathname.startsWith('/api/it/student-password/request')) return true
  if (pathname.startsWith('/api/it/student-password/reset')) return true
  return false
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const requestHeaders = new Headers(req.headers)
  const host = req.headers.get('host') || ''

  // ─── Platform Admin Routes ─────────────────────────────────────────
  if (isPlatformAdminHost(host) || isPlatformPath(pathname)) {
    // Platform public paths (login, setup, webhooks)
    if (isPlatformPublicPath(pathname)) {
      return NextResponse.next({ request: { headers: requestHeaders } })
    }

    // Static assets and Next.js internals
    if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
      return NextResponse.next({ request: { headers: requestHeaders } })
    }

    // Platform admin login page (frontend)
    if (pathname === '/login' || pathname === '/' || pathname === '/admin/login' || pathname === '/admin') {
      return NextResponse.next({ request: { headers: requestHeaders } })
    }

    // All other platform paths require platform JWT
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      // For API routes, return 401 JSON
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { ok: false, error: { code: 'UNAUTHORIZED', message: 'Platform admin authentication required' } },
          { status: 401 }
        )
      }
      // For page routes, let the frontend handle it
      return NextResponse.next({ request: { headers: requestHeaders } })
    }

    const token = authHeader.slice(7)
    const claims = await verifyPlatformAuthToken(token)
    if (!claims?.adminId) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { ok: false, error: { code: 'INVALID_TOKEN', message: 'Invalid platform admin token' } },
          { status: 401 }
        )
      }
      return NextResponse.next({ request: { headers: requestHeaders } })
    }

    requestHeaders.set('x-platform-admin-id', claims.adminId)
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  // ─── Org-Scoped Routes (existing logic) ────────────────────────────

  // ─── Rate Limiting for Public API Paths ──────────────────────────
  // Applied BEFORE isPublicPath so rate limits run even on public routes.
  // The login endpoint has its own finer-grained limiter in the route handler.
  // Static assets and non-API paths are excluded.
  if (pathname.startsWith('/api/')) {
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown'

    let limiter: typeof publicApiRateLimiter | null = null

    if (pathname === '/api/organizations/signup') {
      limiter = signupRateLimiter
    } else if (
      pathname.startsWith('/api/auth/forgot-password') ||
      pathname.startsWith('/api/auth/set-password')
    ) {
      limiter = publicApiRateLimiter
    }

    if (limiter) {
      limiter.increment(clientIp)
      const limitResult = limiter.check(clientIp)
      if (!limitResult.allowed) {
        return NextResponse.json(
          { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
          { status: 429, headers: getRateLimitHeaders(limitResult) }
        )
      }
    }
  }

  if (pathname === '/app/settings') {
    const url = req.nextUrl.clone()
    url.pathname = '/settings'
    return NextResponse.redirect(url)
  }

  const sub = getSubdomainFromHost(host)
  if (sub) {
    requestHeaders.set('x-org-subdomain', sub)
    if (pathname === '/') {
      const url = req.nextUrl.clone()
      url.pathname = '/app'
      return NextResponse.redirect(url)
    }
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  // Allow onboarding pages to pass through (frontend-only, no org context needed at page level)
  if (pathname.startsWith('/onboarding')) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  if (pathname.startsWith('/athletics/public')) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  if (!pathname.startsWith('/api') && !pathname.startsWith('/app')) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  // ─── CSRF Validation (state-changing API requests) ───────────────
  // Runs BEFORE directOrgId early-return to prevent CSRF bypass via x-org-id header.
  // Only validates when csrf-token cookie is present (backward compat for old sessions).
  if (
    pathname.startsWith('/api/') &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
  ) {
    const csrfCookie = req.cookies.get('csrf-token')?.value
    if (csrfCookie) {
      const csrfHeader = req.headers.get('x-csrf-token')
      if (!csrfHeader) {
        return NextResponse.json(
          { ok: false, error: { code: 'CSRF_INVALID', message: 'Missing CSRF token' } },
          { status: 403 }
        )
      }
      if (csrfCookie !== csrfHeader) {
        return NextResponse.json(
          { ok: false, error: { code: 'CSRF_INVALID', message: 'Invalid CSRF token' } },
          { status: 403 }
        )
      }
    }
  }

  // ─── Direct org-id shortcut (for legacy/internal use) ───────────
  const directOrgId = req.headers.get('x-org-id')?.trim()
  const authHeader = req.headers.get('authorization')

  if (directOrgId) {
    requestHeaders.set('x-org-id', directOrgId)
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  // ─── Token extraction: cookie first, then Authorization header ──
  const cookieToken = req.cookies.get('auth-token')?.value
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const token = cookieToken ?? bearerToken

  if (!token) {
    return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Missing tenant context' } }, { status: 401 })
  }

  const claims = await verifyAuthToken(token)
  if (!claims?.organizationId) {
    return NextResponse.json({ ok: false, error: { code: 'INVALID_TOKEN', message: 'Invalid bearer token' } }, { status: 401 })
  }

  requestHeaders.set('x-org-id', claims.organizationId)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
