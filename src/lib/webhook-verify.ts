/**
 * Shared webhook signature verification utility.
 *
 * Uses HMAC-SHA256 with timing-safe comparison to prevent timing attacks.
 * Supports hex-encoded signatures (the most common format across Stripe, Clever, ClassLink).
 */

import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Verify an HMAC-SHA256 webhook signature.
 *
 * @param payload - Raw request body string (as received, before any parsing)
 * @param signature - Hex-encoded HMAC-SHA256 signature from the request header
 * @param secret - Shared secret used to compute the expected HMAC
 * @returns true if the signature is valid, false otherwise
 */
export function verifyHmacSha256(payload: string, signature: string, secret: string): boolean {
  try {
    const expected = createHmac('sha256', secret).update(payload, 'utf8').digest('hex')
    const expectedBuf = Buffer.from(expected, 'hex')
    const receivedBuf = Buffer.from(signature, 'hex')

    // Buffers must be the same length for timingSafeEqual
    if (expectedBuf.length !== receivedBuf.length) return false

    return timingSafeEqual(expectedBuf, receivedBuf)
  } catch {
    return false
  }
}
