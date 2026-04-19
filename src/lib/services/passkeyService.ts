/**
 * Passkey Service — WebAuthn credential registration and authentication
 *
 * Handles passkey (Face ID, Touch ID, Windows Hello, hardware keys)
 * registration, authentication, and credential management.
 */

import {
  generateRegistrationOptions as genRegOpts,
  verifyRegistrationResponse,
  generateAuthenticationOptions as genAuthOpts,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server'
import { rawPrisma } from '@/lib/db'
import { createHash, randomBytes } from 'node:crypto'

// ─── Config ──────────────────────────────────────────────────────────────────

const RP_NAME = process.env.WEBAUTHN_RP_NAME || 'Lionheart'
const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost'
const ORIGIN = process.env.WEBAUTHN_ORIGIN || 'http://localhost:3004'
const CHALLENGE_TTL_MS = 5 * 60 * 1000 // 5 minutes

function getExpectedOrigins(): string | ((origin: string) => boolean) {
  // In production with subdomains (*.lionheartapp.com), accept any origin
  // matching the RP ID domain rather than listing every tenant subdomain.
  if (RP_ID !== 'localhost') {
    return (origin: string) => {
      try {
        const url = new URL(origin)
        return url.protocol === 'https:' && (url.hostname === RP_ID || url.hostname.endsWith(`.${RP_ID}`))
      } catch {
        return false
      }
    }
  }
  return ORIGIN
}

// ─── Registration ────────────────────────────────────────────────────────────

/**
 * Generate WebAuthn registration options and store a challenge.
 * Returns the options to pass to the browser, plus a challengeId to send back.
 */
export async function generateRegistrationOptions(userId: string) {
  const user = await rawPrisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      passkeys: { select: { credentialId: true, transports: true } },
    },
  })
  if (!user) throw new Error('User not found')

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email

  const options = await genRegOpts({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: user.email,
    userDisplayName: displayName,
    // Prevent re-registering the same authenticator
    excludeCredentials: user.passkeys.map((pk) => ({
      id: pk.credentialId,
      transports: pk.transports as AuthenticatorTransportFuture[],
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    attestationType: 'none',
  })

  // Store the challenge
  const challengeRecord = await rawPrisma.passkeyChallenge.create({
    data: {
      userId,
      challenge: options.challenge,
      type: 'registration',
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
  })

  // Clean up expired challenges opportunistically
  rawPrisma.passkeyChallenge
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => {})

  return { options, challengeId: challengeRecord.id }
}

/**
 * Verify a registration response and save the credential.
 */
export async function verifyAndSaveRegistration(
  userId: string,
  credential: RegistrationResponseJSON,
  challengeId: string,
  name?: string
) {
  // Retrieve and consume the challenge (single-use)
  const challengeRecord = await rawPrisma.passkeyChallenge.findUnique({
    where: { id: challengeId },
  })

  if (!challengeRecord) throw new Error('Challenge not found')
  if (challengeRecord.userId !== userId) throw new Error('Challenge mismatch')
  if (challengeRecord.type !== 'registration') throw new Error('Wrong challenge type')
  if (challengeRecord.expiresAt < new Date()) {
    await rawPrisma.passkeyChallenge.delete({ where: { id: challengeId } })
    throw new Error('Challenge expired')
  }

  // Delete challenge before verification (single-use)
  await rawPrisma.passkeyChallenge.delete({ where: { id: challengeId } })

  const verification = await verifyRegistrationResponse({
    response: credential,
    expectedChallenge: challengeRecord.challenge,
    expectedOrigin: getExpectedOrigins(),
    expectedRPID: RP_ID,
    requireUserVerification: false,
  })

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('Registration verification failed')
  }

  const { credential: cred, credentialDeviceType, credentialBackedUp, aaguid } =
    verification.registrationInfo

  // Save the credential
  const passkey = await rawPrisma.userPasskey.create({
    data: {
      userId,
      credentialId: cred.id,
      publicKey: Buffer.from(cred.publicKey),
      counter: BigInt(cred.counter),
      transports: (cred.transports ?? []) as string[],
      name: name || 'Passkey',
      aaguid: aaguid || null,
      deviceType: credentialDeviceType || null,
      backedUp: credentialBackedUp ?? false,
    },
  })

  // Ensure mfaEnabled is set
  const user = await rawPrisma.user.findUnique({
    where: { id: userId },
    select: { email: true, organizationId: true, mfaEnabled: true, mfaBackupCodes: true },
  })

  if (user && !user.mfaEnabled) {
    await rawPrisma.user.update({
      where: {
        organizationId_email: {
          organizationId: user.organizationId,
          email: user.email,
        },
      },
      data: { mfaEnabled: true },
    })
  }

  // Generate backup codes if user doesn't have any yet
  let backupCodes: string[] | null = null
  if (user && !user.mfaBackupCodes) {
    backupCodes = generateBackupCodes()
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
  }

  return {
    passkey: {
      id: passkey.id,
      name: passkey.name,
      deviceType: passkey.deviceType,
      backedUp: passkey.backedUp,
      createdAt: passkey.createdAt.toISOString(),
    },
    backupCodes,
  }
}

// ─── Authentication ──────────────────────────────────────────────────────────

/**
 * Generate WebAuthn authentication options for a user during login.
 */
export async function generateAuthenticationOptions(userId: string) {
  const passkeys = await rawPrisma.userPasskey.findMany({
    where: { userId },
    select: { credentialId: true, transports: true },
  })

  if (passkeys.length === 0) throw new Error('No passkeys registered')

  const options = await genAuthOpts({
    rpID: RP_ID,
    allowCredentials: passkeys.map((pk) => ({
      id: pk.credentialId,
      transports: pk.transports as AuthenticatorTransportFuture[],
    })),
    userVerification: 'preferred',
  })

  const challengeRecord = await rawPrisma.passkeyChallenge.create({
    data: {
      userId,
      challenge: options.challenge,
      type: 'authentication',
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
  })

  // Opportunistic cleanup
  rawPrisma.passkeyChallenge
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => {})

  return { options, challengeId: challengeRecord.id }
}

/**
 * Verify an authentication response during login.
 */
export async function verifyAuthentication(
  userId: string,
  credential: AuthenticationResponseJSON,
  challengeId: string
): Promise<boolean> {
  const challengeRecord = await rawPrisma.passkeyChallenge.findUnique({
    where: { id: challengeId },
  })

  if (!challengeRecord) throw new Error('Challenge not found')
  if (challengeRecord.userId !== userId) throw new Error('Challenge mismatch')
  if (challengeRecord.type !== 'authentication') throw new Error('Wrong challenge type')
  if (challengeRecord.expiresAt < new Date()) {
    await rawPrisma.passkeyChallenge.delete({ where: { id: challengeId } })
    throw new Error('Challenge expired')
  }

  // Delete challenge (single-use)
  await rawPrisma.passkeyChallenge.delete({ where: { id: challengeId } })

  // Find the credential
  const passkey = await rawPrisma.userPasskey.findFirst({
    where: { userId, credentialId: credential.id },
  })

  if (!passkey) throw new Error('Passkey not found')

  const verification = await verifyAuthenticationResponse({
    response: credential,
    expectedChallenge: challengeRecord.challenge,
    expectedOrigin: getExpectedOrigins(),
    expectedRPID: RP_ID,
    credential: {
      id: passkey.credentialId,
      publicKey: new Uint8Array(passkey.publicKey),
      counter: Number(passkey.counter),
      transports: passkey.transports as AuthenticatorTransportFuture[],
    },
    requireUserVerification: false,
  })

  if (!verification.verified) return false

  // Update counter and lastUsedAt
  await rawPrisma.userPasskey.update({
    where: { id: passkey.id },
    data: {
      counter: BigInt(verification.authenticationInfo.newCounter),
      lastUsedAt: new Date(),
    },
  })

  return true
}

// ─── Credential Management ───────────────────────────────────────────────────

export async function listPasskeys(userId: string) {
  const passkeys = await rawPrisma.userPasskey.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      deviceType: true,
      backedUp: true,
      createdAt: true,
      lastUsedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return passkeys.map((pk) => ({
    ...pk,
    createdAt: pk.createdAt.toISOString(),
    lastUsedAt: pk.lastUsedAt?.toISOString() ?? null,
  }))
}

export async function renamePasskey(
  userId: string,
  passkeyId: string,
  name: string
): Promise<void> {
  const passkey = await rawPrisma.userPasskey.findFirst({
    where: { id: passkeyId, userId },
  })
  if (!passkey) throw new Error('Passkey not found')

  await rawPrisma.userPasskey.update({
    where: { id: passkeyId },
    data: { name: name.trim() || 'Passkey' },
  })
}

export async function deletePasskey(
  userId: string,
  passkeyId: string
): Promise<void> {
  const passkey = await rawPrisma.userPasskey.findFirst({
    where: { id: passkeyId, userId },
  })
  if (!passkey) throw new Error('Passkey not found')

  // Check if this is the last MFA method
  const user = await rawPrisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      organizationId: true,
      mfaSecret: true,
      passkeys: { select: { id: true } },
      organization: { select: { mfaRequired: true } },
    },
  })

  if (!user) throw new Error('User not found')

  const remainingPasskeys = user.passkeys.filter((pk) => pk.id !== passkeyId).length
  const hasTotpSecret = !!user.mfaSecret
  const isLastMfaMethod = remainingPasskeys === 0 && !hasTotpSecret

  // Block deletion if org requires MFA and this is the last method
  if (isLastMfaMethod && user.organization?.mfaRequired) {
    throw new Error('Cannot remove last MFA method — your organization requires two-factor authentication')
  }

  await rawPrisma.userPasskey.delete({ where: { id: passkeyId } })

  // If no MFA methods remain, disable MFA on user
  if (isLastMfaMethod) {
    await rawPrisma.user.update({
      where: {
        organizationId_email: {
          organizationId: user.organizationId,
          email: user.email,
        },
      },
      data: {
        mfaEnabled: false,
        mfaBackupCodes: null,
      },
    })
  }
}

export async function hasPasskeys(userId: string): Promise<boolean> {
  const count = await rawPrisma.userPasskey.count({ where: { userId } })
  return count > 0
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BACKUP_CODE_COUNT = 10

function generateBackupCodes(): string[] {
  const codes: string[] = []
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const raw = randomBytes(4).toString('hex').toUpperCase()
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`)
  }
  return codes
}

function hashBackupCode(code: string): string {
  const normalized = code.replace(/-/g, '').toUpperCase()
  return createHash('sha256').update(normalized).digest('hex')
}
