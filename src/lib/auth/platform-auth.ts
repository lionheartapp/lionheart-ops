/**
 * Platform Admin Authentication
 * 
 * Separate JWT system for platform admins (SaaS operators).
 * Platform tokens do NOT contain organizationId — they operate above org scope.
 */

import { SignJWT, jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.PLATFORM_AUTH_SECRET || process.env.AUTH_SECRET || 'dev-platform-secret')

export type PlatformAuthClaims = {
  adminId: string
  email: string
  type: 'platform' // discriminator to prevent cross-use with org tokens
}

export async function signPlatformAuthToken(claims: Omit<PlatformAuthClaims, 'type'>): Promise<string> {
  return await new SignJWT({ ...claims, type: 'platform' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // shorter expiry for admin sessions
    .sign(secret)
}

export async function verifyPlatformAuthToken(token: string): Promise<PlatformAuthClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    if (!payload.adminId || !payload.email || payload.type !== 'platform') return null
    return {
      adminId: String(payload.adminId),
      email: String(payload.email),
      type: 'platform',
    }
  } catch {
    return null
  }
}
