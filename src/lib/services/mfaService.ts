/**
 * MFA Service — TOTP-based two-factor authentication
 *
 * Handles secret generation, QR code creation, code verification,
 * and backup code management.
 */

import { TOTP, generateSecret as otpGenerateSecret, generateURI, verifySync } from 'otplib'
import * as QRCode from 'qrcode'
import { createHash, randomBytes } from 'node:crypto'
import { rawPrisma } from '@/lib/db'

const APP_NAME = 'Lionheart'
const BACKUP_CODE_COUNT = 10
const TOTP_PERIOD = 30 // seconds
const TOTP_DIGITS = 6

// ─── Secret Generation ──────────────────────────────────────────────────────

/**
 * Generate a new TOTP secret and QR code data URL for setup.
 */
export async function generateMfaSetup(userId: string): Promise<{
  secret: string
  qrCodeDataUrl: string
  otpauthUrl: string
}> {
  const user = await rawPrisma.user.findUnique({
    where: { id: userId },
    select: { email: true, organization: { select: { name: true } } },
  })

  if (!user) throw new Error('User not found')

  const secret = otpGenerateSecret()
  const orgLabel = user.organization?.name || APP_NAME
  const otpauthUrl = generateURI({
    secret,
    issuer: orgLabel,
    label: user.email,
    algorithm: 'sha1',
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
  })
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl)

  return { secret, qrCodeDataUrl, otpauthUrl }
}

// ─── Code Verification ──────────────────────────────────────────────────────

/**
 * Verify a TOTP code against a secret.
 * Allows a 1-step window (30 seconds before/after) for clock drift.
 */
export function verifyTotpCode(code: string, secret: string): boolean {
  const result = verifySync({ token: code, secret })
  return result.valid === true
}

// ─── Setup Confirmation ─────────────────────────────────────────────────────

/**
 * Confirm MFA setup: verify the first code, save the secret, generate backup codes.
 * Returns the plaintext backup codes (shown once to the user).
 */
export async function confirmMfaSetup(
  userId: string,
  secret: string,
  code: string
): Promise<{ backupCodes: string[] }> {
  // Verify the code is correct before saving
  if (!verifyTotpCode(code, secret)) {
    throw new Error('Invalid verification code. Please try again.')
  }

  // Generate backup codes
  const backupCodes = generateBackupCodes()
  const hashedCodes = backupCodes.map(hashBackupCode)

  // Look up user email for compound unique key
  const user = await rawPrisma.user.findUnique({
    where: { id: userId },
    select: { email: true, organizationId: true },
  })
  if (!user) throw new Error('User not found')

  await rawPrisma.user.update({
    where: {
      organizationId_email: {
        organizationId: user.organizationId,
        email: user.email,
      },
    },
    data: {
      mfaEnabled: true,
      mfaSecret: secret,
      mfaBackupCodes: JSON.stringify(hashedCodes),
      mfaEnabledAt: new Date(),
    },
  })

  return { backupCodes }
}

// ─── Disable MFA ────────────────────────────────────────────────────────────

export async function disableMfa(userId: string): Promise<void> {
  const user = await rawPrisma.user.findUnique({
    where: { id: userId },
    select: { email: true, organizationId: true },
  })
  if (!user) throw new Error('User not found')

  await rawPrisma.user.update({
    where: {
      organizationId_email: {
        organizationId: user.organizationId,
        email: user.email,
      },
    },
    data: {
      mfaEnabled: false,
      mfaSecret: null,
      mfaBackupCodes: null,
      mfaEnabledAt: null,
    },
  })
}

// ─── Login Verification ─────────────────────────────────────────────────────

/**
 * Verify a TOTP code or backup code during login.
 * Returns true if valid.
 */
export async function verifyMfaForLogin(
  userId: string,
  code: string
): Promise<boolean> {
  const user = await rawPrisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      organizationId: true,
      mfaSecret: true,
      mfaBackupCodes: true,
    },
  })

  if (!user?.mfaSecret) return false

  // Try TOTP code first
  if (verifyTotpCode(code, user.mfaSecret)) {
    return true
  }

  // Try backup code (codes are single-use)
  if (user.mfaBackupCodes) {
    const hashedCodes: string[] = JSON.parse(user.mfaBackupCodes)
    const hashedInput = hashBackupCode(code)
    const matchIndex = hashedCodes.findIndex((hc) => hc === hashedInput)

    if (matchIndex >= 0) {
      // Remove the used backup code
      const remaining = [...hashedCodes]
      remaining.splice(matchIndex, 1)

      await rawPrisma.user.update({
        where: {
          organizationId_email: {
            organizationId: user.organizationId,
            email: user.email,
          },
        },
        data: { mfaBackupCodes: JSON.stringify(remaining) },
      })

      return true
    }
  }

  return false
}

// ─── Backup Codes ───────────────────────────────────────────────────────────

/**
 * Regenerate backup codes (invalidates old ones).
 * Returns plaintext codes to show the user once.
 */
export async function regenerateBackupCodes(userId: string): Promise<string[]> {
  const user = await rawPrisma.user.findUnique({
    where: { id: userId },
    select: { email: true, organizationId: true, mfaEnabled: true },
  })
  if (!user) throw new Error('User not found')
  if (!user.mfaEnabled) throw new Error('MFA is not enabled')

  const backupCodes = generateBackupCodes()
  const hashedCodes = backupCodes.map(hashBackupCode)

  await rawPrisma.user.update({
    where: {
      organizationId_email: {
        organizationId: user.organizationId,
        email: user.email,
      },
    },
    data: { mfaBackupCodes: JSON.stringify(hashedCodes) },
  })

  return backupCodes
}

// ─── Check if org requires MFA ──────────────────────────────────────────────

export async function isOrgMfaRequired(orgId: string): Promise<boolean> {
  const org = await rawPrisma.organization.findUnique({
    where: { id: orgId },
    select: { mfaRequired: true },
  })
  return org?.mfaRequired ?? false
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateBackupCodes(): string[] {
  const codes: string[] = []
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    // 8-character alphanumeric codes, grouped as XXXX-XXXX for readability
    const raw = randomBytes(4).toString('hex').toUpperCase()
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`)
  }
  return codes
}

function hashBackupCode(code: string): string {
  // Normalize: remove dashes and uppercase
  const normalized = code.replace(/-/g, '').toUpperCase()
  return createHash('sha256').update(normalized).digest('hex')
}
