import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthToken, signAuthToken } from '@/lib/auth'
import { verifyPlatformAuthToken } from '@/lib/auth/platform-auth'
import { authCookieOptions } from '@/lib/auth/cookie-options'
import { publicApiRateLimiter, signupRateLimiter, eventRegistrationRateLimiter, aiChatRateLimiter, getRateLimitHeaders } from '@/lib/rate-limit'


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
  if (pathname.startsWith('/api/auth/mfa/verify')) return true // MFA verification during login (uses temp token, not auth cookie)
  if (pathname.startsWith('/api/auth/passkey/authenticate')) return true // Passkey assertion during login (uses temp token)
  // NOTE: /api/auth/me and /api/auth/logout are NOT public — they require auth cookie
  if (pathname === '/api/health') return true // Uptime monitoring — no auth
  if (pathname.startsWith('/api/branding')) return true
  if (pathname.startsWith('/api/organizations/slug-check')) return true
  if (pathname.startsWith('/api/organizations/signup')) return true
  if (pathname.startsWith('/api/public/')) return true
  if (pathname === '/sw.js') return true
  if (pathname === '/manifest.json') return true
  if (pathname === '/offline') return true
  if (pathname.startsWith('/icons/')) return true
  if (pathname === '/it/sub') return true
  if (pathname.startsWith('/f/qr/')) return true
  if (pathname.startsWith('/r/')) return true
  if (pathname === '/it/password-reset') return true
  if (pathname.startsWith('/api/it/magic-links/') && pathname.includes('/validate')) return true
  if (pathname === '/api/it/tickets/sub') return true
  if (pathname.startsWith('/api/webhooks/clever')) return true
  if (pathname.startsWith('/api/webhooks/classlink')) return true
  // Stripe subscription-lifecycle webhook — Stripe signs the request body
  if (pathname.startsWith('/api/stripe/webhook')) return true
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
  // Public event registration pages and APIs (Phase 20)
  if (pathname.startsWith('/events/')) return true
  if (pathname.startsWith('/api/events/register/')) return true
  if (pathname.startsWith('/api/registration/')) return true
  // Participant self-service QR endpoint — no auth, registrationId is the access token (Phase 21 QR-03)
  if (pathname.startsWith('/api/events/check-in/')) return true
  // Survey response submission — public POST (parent portal). GET requires auth and enforces it internally.
  if (pathname.match(/^\/api\/events\/projects\/[^/]+\/surveys\/[^/]+\/responses$/)) return true
  // OAuth callbacks — must be public so OAuth redirects land correctly
  if (pathname.startsWith('/api/integrations/google-calendar/callback')) return true
  if (pathname.startsWith('/api/integrations/planning-center/callback')) return true
  return false
}

/**
 * Coarse viewport classification for server components.
 *
 * Audit ref M4: layouts branched on `window.innerWidth` in useEffect, which
 * caused a post-hydration layout shift on mobile (desktop layout flashed in,
 * then jumped to mobile). By sniffing the UA in middleware we can inject an
 * `x-viewport` header that server components read to ship the correct
 * layout on first paint. UA sniffing isn't perfect — CSS media queries are
 * still authoritative — but it eliminates the first-paint mismatch for the
 * ~98% of users on common UAs.
 */
function detectViewport(userAgent: string): 'mobile' | 'tablet' | 'desktop' {
  const ua = userAgent.toLowerCase()
  // iPad identifies as "Macintosh" in UA on iPadOS 13+, so we also check touch hints
  if (/ipad|tablet|playbook|silk/i.test(ua) || (ua.includes('android') && !ua.includes('mobile'))) {
    return 'tablet'
  }
  if (/mobile|iphone|ipod|android.*mobile|blackberry|opera mini|iemobile/i.test(ua)) {
    return 'mobile'
  }
  return 'desktop'
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const requestHeaders = new Headers(req.headers)
  const host = req.headers.get('host') || ''

  // Audit ref M4: expose the detected viewport to downstream server components.
  const userAgent = req.headers.get('user-agent') || ''
  requestHeaders.set('x-viewport', detectViewport(userAgent))

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

    // Redirect bare /login and / to /admin/login on platform admin host
    if (pathname === '/login' || pathname === '/') {
      const url = req.nextUrl.clone()
      url.pathname = '/admin/login'
      return NextResponse.redirect(url)
    }

    // Platform admin login page (frontend)
    if (pathname === '/admin/login' || pathname === '/admin') {
      return NextResponse.next({ request: { headers: requestHeaders } })
    }

    // On admin host, redirect non-admin page paths to the admin panel
    if (isPlatformAdminHost(host) && !pathname.startsWith('/admin') && !pathname.startsWith('/api/')) {
      const url = req.nextUrl.clone()
      url.pathname = '/admin/dashboard'
      return NextResponse.redirect(url)
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
      pathname.startsWith('/api/auth/set-password') ||
      pathname.startsWith('/api/auth/reset-password') ||
      pathname.startsWith('/api/auth/resend-verification')
    ) {
      limiter = publicApiRateLimiter
    } else if (pathname.startsWith('/api/events/register/')) {
      limiter = eventRegistrationRateLimiter
    } else if (
      pathname.startsWith('/api/events/check-in/') ||
      pathname.startsWith('/api/it/student-password/') ||
      pathname === '/api/it/tickets/sub'
    ) {
      limiter = publicApiRateLimiter
    } else if (pathname.startsWith('/api/ai/')) {
      // F-012: every /api/ai/* route uses Gemini and so has direct cost
      // exposure. Previously only /api/ai/assistant/chat was throttled — a
      // misbehaving (or malicious) authenticated user could fire thousands
      // of requests/sec at parse-event, parse-workflow, ai-diagnose, etc.
      // Now all AI routes share the 30/min/IP limit.
      limiter = aiChatRateLimiter
    }

    if (limiter) {
      const limitResult = await limiter.hit(clientIp)
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
  // Runs BEFORE JWT verification/x-org-id injection to prevent CSRF bypass.
  // All non-public API routes reaching this point are protected (see isPublicPath
  // early-return above), so any POST/PUT/PATCH/DELETE here is a state-changing
  // request against a protected endpoint and MUST carry a valid CSRF token.
  //
  // Safe methods (GET/HEAD/OPTIONS) are not checked and may be used by the client
  // to obtain a csrf-token cookie before issuing a state-changing request.
  const isStateChanging =
    pathname.startsWith('/api/') &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)

  if (isStateChanging) {
    const csrfCookie = req.cookies.get('csrf-token')?.value
    const csrfHeader = req.headers.get('x-csrf-token')

    // Missing cookie: authenticated pre-existing session without a CSRF token.
    // Issue one on the 403 response so the client can retry with a matching header.
    if (!csrfCookie) {
      const newToken = crypto.randomUUID()
      const response = NextResponse.json(
        {
          ok: false,
          error: {
            code: 'CSRF_REQUIRED',
            message: 'CSRF token missing. Retry this request with the newly issued token.',
          },
        },
        { status: 403 }
      )
      response.cookies.set('csrf-token', newToken, {
        httpOnly: false, // Must be readable by client JS to echo into x-csrf-token header (double-submit pattern)
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        // Match auth-token domain so the cookie survives subdomain hops (www → {orgSlug})
        ...(process.env.NODE_ENV === 'production' ? { domain: '.lionheartapp.com' } : {}),
      })
      return response
    }

    // Cookie present: require a matching header.
    if (!csrfHeader) {
      return NextResponse.json(
        { ok: false, error: { code: 'CSRF_INVALID', message: 'Missing CSRF token header' } },
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

  // ─── Token extraction: cookie first, then Authorization header ──
  const authHeader = req.headers.get('authorization')
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

  // Messaging feature gate moved to the API routes themselves (D-02 / T-24-06)
  // — PrismaClient cannot run in Edge middleware.

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  // ─── Sliding window: refresh token when past halfway (3.5 days) ──
  // This keeps active users logged in without ever interrupting them,
  // while inactive users get logged out after 7 days.
  if (cookieToken) {
    try {
      const { jwtVerify } = await import('jose')
      const secret = new TextEncoder().encode(process.env.AUTH_SECRET!)
      const { payload } = await jwtVerify(cookieToken, secret)
      const exp = (payload.exp ?? 0) as number
      const iat = (payload.iat ?? 0) as number
      const totalLife = exp - iat
      const remaining = exp - Math.floor(Date.now() / 1000)
      // Refresh when less than half the token lifetime remains
      if (totalLife > 0 && remaining < totalLife / 2) {
        const freshToken = await signAuthToken({
          userId: claims.userId,
          organizationId: claims.organizationId,
          email: claims.email,
        })
        const opts = authCookieOptions()
        response.cookies.set('auth-token', freshToken, {
          httpOnly: opts.httpOnly,
          secure: opts.secure,
          sameSite: opts.sameSite,
          path: opts.path,
          maxAge: opts.maxAge,
          ...(opts.domain ? { domain: opts.domain } : {}),
        })
      }
    } catch {
      // Token refresh is best-effort — don't block the request
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
