import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/lib/cors'

export function middleware(req: NextRequest) {
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: corsHeaders })
  }

  // Require x-org-id or Authorization Bearer for API requests (multi-tenant context)
  // Exclude: cron, auth (signup, login, Google OAuth, debug-url), setup (maps-key is public for onboarding)
  if (
    req.nextUrl.pathname.startsWith('/api/cron/') ||
    req.nextUrl.pathname === '/api/auth/check-school' ||
    req.nextUrl.pathname === '/api/setup/org' ||
    req.nextUrl.pathname === '/api/setup/maps-key' ||
    req.nextUrl.pathname === '/api/setup/logo-url' ||
    req.nextUrl.pathname === '/api/setup/search-school' ||
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

export const config = { matcher: '/api/:path*' }
