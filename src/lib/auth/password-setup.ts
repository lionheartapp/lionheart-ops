import { createHash, randomBytes } from 'crypto'

export function hashSetupToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function generateSetupToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Build the tenant-specific base URL for an organization.
 * In production: https://{slug}.lionheartapp.com
 * Locally: http://{slug}.localhost:3004
 */
function getTenantUrl(slug: string): string {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    return `https://${slug}.lionheartapp.com`
  }
  const port = process.env.PORT || '3004'
  return `http://${slug}.localhost:${port}`
}

export function getSetupLink(token: string, slug: string): string {
  const base = getTenantUrl(slug)
  return `${base}/set-password?token=${encodeURIComponent(token)}`
}

export function getResetLink(token: string, slug: string): string {
  const base = getTenantUrl(slug)
  return `${base}/reset-password?token=${encodeURIComponent(token)}`
}

export function getVerificationLink(token: string, slug: string): string {
  const base = getTenantUrl(slug)
  return `${base}/api/auth/verify-email?token=${encodeURIComponent(token)}`
}
