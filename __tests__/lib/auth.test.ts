import { describe, it, expect } from 'vitest'
import { signAuthToken, verifyAuthToken } from '@/lib/auth'
import type { AuthClaims } from '@/lib/auth'

const validClaims: AuthClaims = {
  userId: 'u1',
  organizationId: 'o1',
  email: 'a@b.com',
}

describe('signAuthToken', () => {
  it('returns a string with two dots (JWT format)', async () => {
    const token = await signAuthToken(validClaims)
    expect(typeof token).toBe('string')
    const parts = token.split('.')
    expect(parts).toHaveLength(3)
  })
})

describe('verifyAuthToken', () => {
  it('returns the original claims for a valid token', async () => {
    const token = await signAuthToken(validClaims)
    const result = await verifyAuthToken(token)
    expect(result).not.toBeNull()
    expect(result?.userId).toBe(validClaims.userId)
    expect(result?.organizationId).toBe(validClaims.organizationId)
    expect(result?.email).toBe(validClaims.email)
  })

  it('returns null for garbage input', async () => {
    const result = await verifyAuthToken('garbage')
    expect(result).toBeNull()
  })

  it('returns null for a token with a corrupted signature', async () => {
    const token = await signAuthToken(validClaims)
    const parts = token.split('.')
    // Corrupt the signature part
    parts[2] = parts[2].slice(0, -4) + 'XXXX'
    const corrupted = parts.join('.')
    const result = await verifyAuthToken(corrupted)
    expect(result).toBeNull()
  })
})
