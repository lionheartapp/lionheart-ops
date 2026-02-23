import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthToken } from '@/lib/auth'

const PUBLIC_PATHS = new Set(['/', '/login', '/set-password', '/app', '/dashboard', '/settings'])
const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'platform', 'admin'])
const APEX_HOSTS = new Set(['lionheartapp.com', 'www.lionheartapp.com', 'localhost', '127.0.0.1'])

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

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true
  if (pathname.startsWith('/_next')) return true
  if (pathname.startsWith('/favicon')) return true
  if (pathname.startsWith('/api/auth/login')) return true
  if (pathname.startsWith('/api/auth/set-password')) return true
  if (pathname.startsWith('/api/branding')) return true
  if (pathname.startsWith('/api/organizations/slug-check')) return true
  if (pathname.startsWith('/api/organizations/signup')) return true
  return false
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const requestHeaders = new Headers(req.headers)

  if (pathname === '/app/settings') {
    const url = req.nextUrl.clone()
    url.pathname = '/settings'
    return NextResponse.redirect(url)
  }

  const host = req.headers.get('host') || ''
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

  if (!pathname.startsWith('/api') && !pathname.startsWith('/app')) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  const directOrgId = req.headers.get('x-org-id')?.trim()
  const authHeader = req.headers.get('authorization')

  if (directOrgId) {
    requestHeaders.set('x-org-id', directOrgId)
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Missing tenant context' } }, { status: 401 })
  }

  const token = authHeader.slice(7)
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
