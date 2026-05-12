/**
 * OAuth Token Encryption
 *
 * Encrypts/decrypts OAuth access and refresh tokens before storing them
 * in IntegrationCredential. Uses AES-256-GCM with AUTH_SECRET as the key source.
 *
 * Gracefully handles unencrypted tokens during migration — if decryption fails
 * and the value doesn't look encrypted, returns it as-is.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
// Prefix to identify encrypted values (won't appear in base64 OAuth tokens)
const ENCRYPTED_PREFIX = 'enc::'

function deriveKey(): Buffer {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is required for token encryption')
  // Derive a 32-byte key from AUTH_SECRET using SHA-256
  return createHash('sha256').update(secret).digest()
}

/**
 * Encrypt a plaintext token. Returns a string prefixed with "enc::" so we
 * can distinguish encrypted from legacy plaintext values.
 */
export function encryptToken(plaintext: string): string {
  const key = deriveKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  // Format: enc::iv:authTag:ciphertext (all base64)
  return `${ENCRYPTED_PREFIX}${iv.toString('base64')}.${authTag.toString('base64')}.${encrypted.toString('base64')}`
}

/**
 * Decrypt a token. If the value doesn't have the encrypted prefix,
 * returns it as-is (legacy plaintext — will be encrypted on next write).
 */
export function decryptToken(stored: string): string {
  if (!stored.startsWith(ENCRYPTED_PREFIX)) {
    // Legacy plaintext token — return as-is
    return stored
  }

  const payload = stored.slice(ENCRYPTED_PREFIX.length)
  const [ivB64, tagB64, dataB64] = payload.split('.')
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Malformed encrypted token')
  }

  const key = deriveKey()
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(tagB64, 'base64')
  const encrypted = Buffer.from(dataB64, 'base64')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}

/**
 * Encrypt a token if it's not already encrypted. Safe to call on values
 * that may or may not be encrypted.
 */
export function ensureEncrypted(token: string | null | undefined): string | null {
  if (!token) return null
  if (token.startsWith(ENCRYPTED_PREFIX)) return token
  return encryptToken(token)
}
