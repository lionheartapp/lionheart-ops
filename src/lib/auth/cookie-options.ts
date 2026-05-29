/**
 * Shared cookie options for auth-token, csrf-token, and related cookies.
 *
 * IMPORTANT: the app is multi-tenant with subdomain routing:
 *   - Signup and public marketing live on www.lionheartapp.com
 *   - Each tenant's dashboard lives on {orgSlug}.lionheartapp.com
 *   - The platform admin lives on platform.lionheartapp.com
 *
 * We need the auth cookie to follow the user across subdomains, so we set
 * `domain: '.lionheartapp.com'` in production. That makes the cookie valid
 * for every `*.lionheartapp.com` host and for the apex domain.
 *
 * In local dev (NODE_ENV !== 'production') we omit `domain` entirely so the
 * cookie is host-only — avoids cookie leaking across unrelated localhost
 * projects.
 */

export interface CookieOptions {
  httpOnly: boolean
  secure: boolean
  sameSite: 'lax' | 'strict' | 'none'
  path: string
  maxAge?: number
  domain?: string
}

function configuredCookieHost(): string | null {
  const rawUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_PLATFORM_URL || process.env.E2E_BASE_URL
  if (!rawUrl) return null

  try {
    return new URL(rawUrl).hostname
  } catch {
    return null
  }
}

function isLocalHost(hostname: string | null): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

const COOKIE_HOST = configuredCookieHost()
const IS_LOCAL_COOKIE_HOST = isLocalHost(COOKIE_HOST)
const USE_SECURE_COOKIES = process.env.NODE_ENV === 'production' && !IS_LOCAL_COOKIE_HOST
const COOKIE_DOMAIN =
  process.env.NODE_ENV === 'production' && COOKIE_HOST?.endsWith('lionheartapp.com')
    ? '.lionheartapp.com'
    : undefined

/**
 * Options for the primary auth-token cookie (httpOnly).
 */
export function authCookieOptions(options?: { maxAge?: number }): CookieOptions {
  return {
    httpOnly: true,
    secure: USE_SECURE_COOKIES,
    sameSite: 'lax',
    path: '/',
    maxAge: options?.maxAge ?? 7 * 24 * 60 * 60, // 7 days — middleware auto-refreshes
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
  }
}

/**
 * Options for the CSRF token cookie (non-httpOnly so client JS can read it
 * and echo into the X-CSRF-Token header for double-submit verification).
 */
export function csrfCookieOptions(options?: { maxAge?: number }): CookieOptions {
  return {
    httpOnly: false,
    secure: USE_SECURE_COOKIES,
    sameSite: 'lax',
    path: '/',
    maxAge: options?.maxAge ?? 7 * 24 * 60 * 60,
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
  }
}

/**
 * Options for clearing a cookie (maxAge: 0). Must match domain of the
 * original set call or the browser won't actually clear it.
 */
export function clearCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: USE_SECURE_COOKIES,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
  }
}
