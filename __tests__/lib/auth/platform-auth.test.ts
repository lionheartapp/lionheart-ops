import { describe, it, expect } from 'vitest'
import { signPlatformAuthToken, verifyPlatformAuthToken } from '@/lib/auth/platform-auth'

describe('signPlatformAuthToken + verifyPlatformAuthToken', () => {
  it('round-trips: sign then verify returns original claims', async () => {
    const claims = { adminId: 'admin-1', email: 'admin@platform.com' }
    const token = await signPlatformAuthToken(claims)
    const result = await verifyPlatformAuthToken(token)

    expect(result).not.toBeNull()
    expect(result!.adminId).toBe('admin-1')
    expect(result!.email).toBe('admin@platform.com')
    expect(result!.type).toBe('platform')
  })

  it('returns a non-empty JWT string', async () => {
    const token = await signPlatformAuthToken({ adminId: 'a', email: 'a@b.com' })
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(0)
    // JWT has 3 base64url parts
    expect(token.split('.')).toHaveLength(3)
  })
})

describe('verifyPlatformAuthToken', () => {
  it('returns null for garbage token', async () => {
    expect(await verifyPlatformAuthToken('not-a-jwt')).toBeNull()
  })

  it('returns null for empty string', async () => {
    expect(await verifyPlatformAuthToken('')).toBeNull()
  })

  it('returns null for tampered token', async () => {
    const token = await signPlatformAuthToken({ adminId: 'a', email: 'a@b.com' })
    // Corrupt the payload segment
    const parts = token.split('.')
    parts[1] = parts[1] + 'TAMPERED'
    expect(await verifyPlatformAuthToken(parts.join('.'))).toBeNull()
  })
})
