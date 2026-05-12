/**
 * Signed OAuth State Utility
 *
 * HMAC-signs the OAuth state parameter to prevent CSRF and open-redirect attacks.
 * Used by Google Calendar, Microsoft Calendar, and Planning Center OAuth flows.
 */

import { createHmac, timingSafeEqual } from 'crypto'

function getSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is required for OAuth state signing')
  return secret
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url')
}

interface OAuthStatePayload {
  userId?: string
  orgId?: string
  origin?: string
}

/**
 * Encode and HMAC-sign an OAuth state parameter.
 * Format: base64url(json).signature
 */
export function encodeSignedOAuthState(payload: OAuthStatePayload): string {
  const json = JSON.stringify(payload)
  const encoded = Buffer.from(json).toString('base64url')
  const signature = sign(encoded)
  return `${encoded}.${signature}`
}

/**
 * Decode and verify an HMAC-signed OAuth state parameter.
 * Returns null if the signature is invalid or the state is malformed.
 */
export function decodeSignedOAuthState(state: string): OAuthStatePayload | null {
  const dotIndex = state.lastIndexOf('.')
  if (dotIndex === -1) return null

  const encoded = state.slice(0, dotIndex)
  const signature = state.slice(dotIndex + 1)

  // Verify HMAC
  const expected = sign(encoded)
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString())
    return {
      userId: parsed.userId || '',
      orgId: parsed.orgId || '',
      origin: parsed.origin || '',
    }
  } catch {
    return null
  }
}

/**
 * Validate that a redirect origin is on an allowed domain.
 * Prevents open redirects via the OAuth state parameter.
 */
export function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false
  try {
    const url = new URL(origin)
    const hostname = url.hostname
    // Allow lionheartapp.com subdomains and localhost for dev
    return (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname === 'lionheartapp.com' ||
      hostname.endsWith('.lionheartapp.com')
    )
  } catch {
    return false
  }
}
