import { createHash, randomBytes } from 'crypto'

export function hashSetupToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function generateSetupToken(): string {
  return randomBytes(32).toString('hex')
}

function getAppUrl(): string {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_PLATFORM_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'http://127.0.0.1:3004')
  )
}

export function getSetupLink(token: string): string {
  const appUrl = getAppUrl()
  return `${appUrl.replace(/\/$/, '')}/set-password?token=${encodeURIComponent(token)}`
}

export function getResetLink(token: string): string {
  const appUrl = getAppUrl()
  return `${appUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`
}

export function getVerificationLink(token: string): string {
  const appUrl = getAppUrl()
  return `${appUrl.replace(/\/$/, '')}/api/auth/verify-email?token=${encodeURIComponent(token)}`
}
