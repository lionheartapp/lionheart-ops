import { createHash, randomBytes } from 'crypto'

export function hashSetupToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function generateSetupToken(): string {
  return randomBytes(32).toString('hex')
}

export function getSetupLink(token: string): string {
  const appUrl = process.env.APP_URL || 'http://127.0.0.1:3004'
  return `${appUrl.replace(/\/$/, '')}/set-password?token=${encodeURIComponent(token)}`
}
