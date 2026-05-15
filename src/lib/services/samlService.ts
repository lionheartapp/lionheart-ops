/**
 * SAML 2.0 Service Provider (SP) implementation.
 *
 * Uses @node-saml/node-saml to handle SP-initiated SAML login:
 *  1. Generate AuthnRequest → redirect user to IdP
 *  2. Validate assertion from IdP callback → extract user profile
 *  3. Generate SP metadata XML for IdP admins
 *
 * Multi-tenant: each Organization has its own SamlConnection record
 * with IdP-specific configuration (entity ID, SSO URL, certificate).
 */

import { SAML, type SamlConfig, ValidateInResponseTo } from '@node-saml/node-saml'
import { createHmac, timingSafeEqual } from 'crypto'
import { rawPrisma } from '@/lib/db'

// ─── Types ────────────────────────────────────────────────────────────

export interface SamlProfile {
  nameId: string
  email: string
  firstName: string | null
  lastName: string | null
}

interface RelayStatePayload {
  orgId: string
  redirect?: string
}

// ─── Relay State signing (HMAC, same pattern as oauth-state.ts) ──────

function getSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is required for SAML relay state signing')
  return secret
}

function hmacSign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url')
}

export function encodeRelayState(payload: RelayStatePayload): string {
  const json = JSON.stringify(payload)
  const encoded = Buffer.from(json).toString('base64url')
  const signature = hmacSign(encoded)
  return `${encoded}.${signature}`
}

export function decodeRelayState(state: string): RelayStatePayload | null {
  const dotIndex = state.lastIndexOf('.')
  if (dotIndex === -1) return null

  const encoded = state.slice(0, dotIndex)
  const signature = state.slice(dotIndex + 1)

  const expected = hmacSign(encoded)
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString())
    if (!parsed.orgId) return null
    return { orgId: parsed.orgId, redirect: parsed.redirect || undefined }
  } catch {
    return null
  }
}

// ─── Connection lookup ───────────────────────────────────────────────

export async function getSamlConnection(organizationId: string) {
  return rawPrisma.samlConnection.findUnique({
    where: { organizationId },
  })
}

// ─── SP identifiers ─────────────────────────────────────────────────

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3004'
}

export function buildSpEntityId(organizationId: string): string {
  return `${getAppUrl()}/saml/${organizationId}`
}

export function buildAcsUrl(): string {
  return `${getAppUrl()}/api/auth/saml/callback`
}

export function buildMetadataUrl(organizationId: string): string {
  return `${getAppUrl()}/api/auth/saml/metadata/${organizationId}`
}

// ─── node-saml config builder ────────────────────────────────────────

function buildSamlOptions(connection: {
  idpEntityId: string
  idpSsoUrl: string
  idpCertificate: string
  spEntityId: string
  spAcsUrl: string
  nameIdFormat: string
}): SamlConfig {
  return {
    issuer: connection.spEntityId,
    callbackUrl: connection.spAcsUrl,
    entryPoint: connection.idpSsoUrl,
    idpIssuer: connection.idpEntityId,
    idpCert: connection.idpCertificate,
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: false,
    identifierFormat: connection.nameIdFormat,
    // Disable InResponseTo validation — requires server-side session cache
    // which isn't practical on serverless. The signed RelayState prevents CSRF.
    validateInResponseTo: ValidateInResponseTo.never,
  }
}

// ─── Core operations ─────────────────────────────────────────────────

/**
 * Generate the IdP redirect URL for SP-initiated login.
 * Returns the full URL the browser should be redirected to.
 */
export async function generateLoginUrl(
  organizationId: string,
  redirectPath?: string
): Promise<string> {
  const connection = await getSamlConnection(organizationId)
  if (!connection || !connection.enabled) {
    throw new Error('SAML SSO is not configured or not enabled for this organization')
  }

  const saml = new SAML(buildSamlOptions(connection))
  const relayState = encodeRelayState({ orgId: organizationId, redirect: redirectPath })
  const loginUrl = await saml.getAuthorizeUrlAsync(relayState, undefined, {})
  return loginUrl
}

/**
 * Validate a SAML assertion from the IdP callback.
 * Returns the parsed user profile on success.
 */
export async function validateCallback(
  organizationId: string,
  samlResponseBody: { SAMLResponse: string; RelayState?: string }
): Promise<SamlProfile> {
  const connection = await getSamlConnection(organizationId)
  if (!connection || !connection.enabled) {
    throw new Error('SAML SSO is not configured or not enabled for this organization')
  }

  const saml = new SAML(buildSamlOptions(connection))

  const { profile } = await saml.validatePostResponseAsync(samlResponseBody)

  if (!profile) {
    throw new Error('SAML assertion did not contain a valid profile')
  }

  // Extract attributes using the configured mapping
  const attrs = (profile as Record<string, unknown>) || {}
  const nameId = profile.nameID || ''

  // Try configured attribute names, then common fallbacks
  const email = extractAttribute(attrs, connection.emailAttr) || nameId
  const firstName = connection.firstNameAttr
    ? extractAttribute(attrs, connection.firstNameAttr)
    : null
  const lastName = connection.lastNameAttr
    ? extractAttribute(attrs, connection.lastNameAttr)
    : null

  if (!email) {
    throw new Error('SAML assertion did not contain an email address')
  }

  return {
    nameId,
    email: email.toLowerCase().trim(),
    firstName: firstName || null,
    lastName: lastName || null,
  }
}

/**
 * Generate SP metadata XML for IdP administrators to import.
 */
export async function generateSpMetadata(organizationId: string): Promise<string> {
  const connection = await getSamlConnection(organizationId)

  // Build metadata even if connection doesn't exist yet (using defaults)
  const spEntityId = connection?.spEntityId || buildSpEntityId(organizationId)
  const spAcsUrl = connection?.spAcsUrl || buildAcsUrl()
  const nameIdFormat = connection?.nameIdFormat ||
    'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'

  // Generate metadata using node-saml
  const saml = new SAML({
    issuer: spEntityId,
    callbackUrl: spAcsUrl,
    idpCert: 'placeholder', // Not used for metadata generation
    identifierFormat: nameIdFormat,
    wantAssertionsSigned: true,
  })

  return saml.generateServiceProviderMetadata(null, null)
}

// ─── Helpers ─────────────────────────────────────────────────────────

function extractAttribute(
  attrs: Record<string, unknown>,
  attrName: string
): string | null {
  const value = attrs[attrName]
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return null
}
