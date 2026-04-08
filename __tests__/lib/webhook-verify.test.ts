import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import { verifyHmacSha256 } from '@/lib/webhook-verify'

// Helper: compute correct HMAC
function computeHmac(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload, 'utf8').digest('hex')
}

describe('verifyHmacSha256', () => {
  const secret = 'webhook-secret-key'
  const payload = '{"event":"test","data":{"id":"123"}}'

  it('returns true for a valid signature', () => {
    const sig = computeHmac(payload, secret)
    expect(verifyHmacSha256(payload, sig, secret)).toBe(true)
  })

  it('returns false for a wrong signature', () => {
    const sig = computeHmac(payload, secret)
    // Flip last hex char
    const bad = sig.slice(0, -1) + (sig.endsWith('0') ? '1' : '0')
    expect(verifyHmacSha256(payload, bad, secret)).toBe(false)
  })

  it('returns false for a wrong secret', () => {
    const sig = computeHmac(payload, 'wrong-secret')
    expect(verifyHmacSha256(payload, sig, secret)).toBe(false)
  })

  it('returns false for a modified payload', () => {
    const sig = computeHmac(payload, secret)
    expect(verifyHmacSha256(payload + 'tampered', sig, secret)).toBe(false)
  })

  it('returns false for length-mismatched signatures', () => {
    expect(verifyHmacSha256(payload, 'short', secret)).toBe(false)
  })

  it('returns false for empty signature', () => {
    expect(verifyHmacSha256(payload, '', secret)).toBe(false)
  })

  it('returns false for non-hex signature', () => {
    expect(verifyHmacSha256(payload, 'not-a-hex-string!@#$', secret)).toBe(false)
  })

  it('handles empty payload', () => {
    const sig = computeHmac('', secret)
    expect(verifyHmacSha256('', sig, secret)).toBe(true)
  })

  it('handles unicode payload', () => {
    const unicodePayload = '{"name":"日本語テスト"}'
    const sig = computeHmac(unicodePayload, secret)
    expect(verifyHmacSha256(unicodePayload, sig, secret)).toBe(true)
  })

  it('is case-sensitive on payload', () => {
    const sig = computeHmac('Hello', secret)
    expect(verifyHmacSha256('hello', sig, secret)).toBe(false)
  })
})
