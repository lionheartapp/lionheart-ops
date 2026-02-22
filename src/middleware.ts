import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/lib/cors'

const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'platform', 'admin'])

const APEX_HOSTS = new Set([
  'lionheartapp.com',
  'www.lionheartapp.com',
  'localhost',
  '127.0.0.1',
])

function getSubdomainFromHost(host: string): string | null {
  const hostname = host.split(':')[0].toLowerCase()
  if (APEX_HOSTS.has(hostname)) return null
  const base = hostname.replace(/^www\./, '')
  // subdomain.lionheartapp.com or subdomain.localhost
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

export function middleware(req: NextRequest) {
  // Subdomain root → redirect to dashboard (e.g. linfieldchristianschool.lionheartapp.com/ → /app)
  if (req.nextUrl.pathname === '/') {
    const host = req.headers.get('host') || ''
    const sub = getSubdomainFromHost(host)
    if (sub) {
      const url = req.nextUrl.clone()
      url.pathname = '/app'
      return NextResponse.redirect(url)
    }
  }

  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: corsHeaders })
  }

  // Only enforce API auth for /api/* routes (allow /, /login, /app, etc.)
  if (!req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Require x-org-id or Authorization Bearer for API requests (multi-tenant context)
  // Exclude: public, cron, auth, setup, billing webhook (Stripe signature auth)
  if (
    req.nextUrl.pathname.startsWith('/api/public/') ||
    req.nextUrl.pathname === '/api/billing/webhook' ||
    req.nextUrl.pathname.startsWith('/api/cron/') ||
    req.nextUrl.pathname === '/api/auth/check-school' ||
    req.nextUrl.pathname === '/api/setup/org' ||
    req.nextUrl.pathname === '/api/setup/maps-key' ||
    req.nextUrl.pathname === '/api/setup/logo-url' ||
    req.nextUrl.pathname === '/api/setup/search-school' ||
    req.nextUrl.pathname === '/api/setup/extract-brand' ||
    req.nextUrl.pathname.startsWith('/api/places/') ||
    req.nextUrl.pathname === '/api/auth/signup' ||
    req.nextUrl.pathname === '/api/auth/login' ||
    req.nextUrl.pathname === '/api/auth/google' ||
    req.nextUrl.pathname.startsWith('/api/auth/google/') ||
    req.nextUrl.pathname === '/api/auth/debug-url'
  ) {
    return NextResponse.next()
  }
  const orgId = req.headers.get('x-org-id')?.trim()
  const authHeader = req.headers.get('authorization')
  const hasBearer = authHeader?.startsWith('Bearer ')
  if (!orgId && !hasBearer) {
    return new NextResponse(
      JSON.stringify({ error: 'Missing x-org-id header or Authorization Bearer token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // When using x-org-id, validate format. Bearer token is verified in route handlers.
  if (orgId && (orgId.length < 10 || orgId.length > 100)) {
    return new NextResponse(
      JSON.stringify({ error: 'Invalid x-org-id format' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return NextResponse.next()
}

export const config = { matcher: ['/', '/api/:path*'] }
