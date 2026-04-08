import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  hashSetupToken,
  generateSetupToken,
  getSetupLink,
  getResetLink,
  getVerificationLink,
} from '@/lib/auth/password-setup'
import { createHash } from 'crypto'

describe('hashSetupToken', () => {
  it('returns SHA-256 hex digest of the token', () => {
    const token = 'test-token-123'
    const expected = createHash('sha256').update(token).digest('hex')
    expect(hashSetupToken(token)).toBe(expected)
  })

  it('returns 64-char hex string', () => {
    expect(hashSetupToken('any-input')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('returns same hash for same input (deterministic)', () => {
    expect(hashSetupToken('abc')).toBe(hashSetupToken('abc'))
  })

  it('returns different hashes for different inputs', () => {
    expect(hashSetupToken('token-a')).not.toBe(hashSetupToken('token-b'))
  })
})

describe('generateSetupToken', () => {
  it('returns a 64-char hex string (32 random bytes)', () => {
    const token = generateSetupToken()
    expect(token).toMatch(/^[0-9a-f]{64}$/)
  })

  it('generates unique tokens', () => {
    const t1 = generateSetupToken()
    const t2 = generateSetupToken()
    expect(t1).not.toBe(t2)
  })
})

describe('getSetupLink', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('builds local URL with slug and token', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('PORT', '3004')
    // Clear VERCEL env to ensure local path
    delete process.env.VERCEL
    const link = getSetupLink('my-token', 'demo-school')
    expect(link).toBe('http://demo-school.localhost:3004/set-password?token=my-token')
  })

  it('builds production URL with slug', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const link = getSetupLink('my-token', 'demo-school')
    expect(link).toBe('https://demo-school.lionheartapp.com/set-password?token=my-token')
  })

  it('URL-encodes special characters in token', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const link = getSetupLink('tok en+special=chars', 'school')
    expect(link).toContain('tok%20en%2Bspecial%3Dchars')
  })
})

describe('getResetLink', () => {
  it('builds production reset link', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const link = getResetLink('reset-tok', 'my-school')
    expect(link).toBe('https://my-school.lionheartapp.com/reset-password?token=reset-tok')
  })
})

describe('getVerificationLink', () => {
  it('builds production verification link', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const link = getVerificationLink('verify-tok', 'my-school')
    expect(link).toBe('https://my-school.lionheartapp.com/api/auth/verify-email?token=verify-tok')
  })
})
