/**
 * Platform Admin Authentication
 * 
 * Separate JWT system for platform admins (SaaS operators).
 * Platform tokens do NOT contain organizationId — they operate above org scope.
 */

import { SignJWT, jwtVerify } from 'jose'

function getPlatformAuthSecret(): Uint8Array {
  const secret = process.env.PLATFORM_AUTH_SECRET || process.env.AUTH_SECRET
  if (!secret) throw new Error('PLATFORM_AUTH_SECRET or AUTH_SECRET environment variable is required')
  return new TextEncoder().encode(secret)
}

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
    .sign(getPlatformAuthSecret())
}

export async function verifyPlatformAuthToken(token: string): Promise<PlatformAuthClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getPlatformAuthSecret())
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
