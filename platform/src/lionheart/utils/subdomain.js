/**
 * Extract school subdomain from the current host.
 * - linfield.lionheartapp.com → "linfield"
 * - linfield.localhost → "linfield" (Chrome supports this)
 * - ?subdomain=linfield (for local dev when subdomains don't work)
 */
const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'platform', 'admin'])

export function getSubdomain() {
  if (typeof window === 'undefined') return null

  const params = new URLSearchParams(window.location.search)
  const fromQuery = params.get('subdomain')?.trim().toLowerCase()
  if (fromQuery) return fromQuery

  const host = window.location.hostname

  // subdomain.localhost (Chrome)
  if (host.endsWith('.localhost')) {
    const sub = host.replace(/\.localhost$/, '')
    return sub && !RESERVED_SUBDOMAINS.has(sub) ? sub : null
  }

  // production: only real school subdomains (subdomain.lionheartapp.com). Apex (lionheartapp.com) and www (www.lionheartapp.com) = no subdomain.
  const parts = host.split('.')
  if (parts.length > 2) {
    const sub = parts[0]
    if (sub && !RESERVED_SUBDOMAINS.has(sub)) return sub
  }

  return null
}

/** Base URL for "Back to home" when on a school subdomain (main marketing site) */
export function getAppBaseUrl() {
  if (typeof window === 'undefined') return '/'
  const host = window.location.hostname
  const protocol = window.location.protocol
  const port = window.location.port
  // subdomain.localhost or subdomain.lionheartapp.com -> strip subdomain
  if (host.endsWith('.localhost')) {
    return `${protocol}//localhost${port ? ':' + port : ''}`
  }
  const parts = host.split('.')
  if (parts.length >= 2 && !['www', 'app', 'api'].includes(parts[0])) {
    const baseHost = parts.slice(-2).join('.') // lionheartapp.com
    return `${protocol}//${baseHost}${port && port !== '80' && port !== '443' ? ':' + port : ''}`
  }
  return `${protocol}//${host}${port ? ':' + port : ''}`
}
