/**
 * SAML Assertion Consumer Service (ACS) — POST /api/auth/saml/callback
 *
 * Public endpoint (no auth, no CSRF). Receives the SAML Response from the IdP
 * after the user authenticates. Validates the assertion, finds or provisions the
 * user, issues a JWT, sets the auth cookie, and redirects to the app.
 */

import { NextRequest, NextResponse } from 'next/server'
import { signAuthToken } from '@/lib/auth'
import { authCookieOptions, csrfCookieOptions } from '@/lib/auth/cookie-options'
import { rawPrisma } from '@/lib/db'
import { runWithOrgContext } from '@/lib/org-context'
import { prisma } from '@/lib/db'
import { validateCallback, decodeRelayState } from '@/lib/services/samlService'
import { audit } from '@/lib/services/auditService'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const log = logger.child({ route: '/api/auth/saml/callback', method: 'POST' })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3004'

  try {
    // Parse the URL-encoded form body (IdP posts SAMLResponse + RelayState)
    const formData = await req.formData()
    const samlResponse = formData.get('SAMLResponse') as string | null
    const relayState = formData.get('RelayState') as string | null

    if (!samlResponse) {
      log.warn('SAML callback missing SAMLResponse')
      return redirectWithError(appUrl, 'missing_response')
    }

    // Decode RelayState to get organizationId
    if (!relayState) {
      log.warn('SAML callback missing RelayState')
      return redirectWithError(appUrl, 'missing_state')
    }

    const relay = decodeRelayState(relayState)
    if (!relay) {
      log.warn('SAML callback invalid RelayState signature')
      return redirectWithError(appUrl, 'invalid_state')
    }

    const { orgId: organizationId, redirect: redirectPath } = relay

    // Validate the SAML assertion
    const profile = await validateCallback(organizationId, {
      SAMLResponse: samlResponse,
      RelayState: relayState,
    })

    // Look up or provision the user within org context
    const result = await runWithOrgContext(organizationId, async () => {
      const existingUser = await prisma.user.findFirst({
        where: { email: profile.email },
        select: {
          id: true,
          email: true,
          status: true,
          authMethod: true,
          organizationId: true,
        },
      })

      if (existingUser) {
        if (existingUser.status !== 'ACTIVE') {
          return { error: 'account_inactive' as const }
        }

        // Update SAML-specific fields if needed
        if (existingUser.authMethod !== 'SAML' || !existingUser.id) {
          await prisma.user.update({
            where: { organizationId_email: { organizationId, email: profile.email } },
            data: {
              authMethod: 'SAML',
              samlNameId: profile.nameId,
              ...(profile.firstName && !existingUser.id ? {} : {}),
            },
          })
        }

        return { userId: existingUser.id, email: existingUser.email }
      }

      // User not found — check JIT provisioning
      const connection = await rawPrisma.samlConnection.findUnique({
        where: { organizationId },
        select: { autoProvisionUsers: true, defaultRoleId: true },
      })

      if (!connection?.autoProvisionUsers) {
        return { error: 'user_not_found' as const }
      }

      // JIT provision: create the user
      const newUser = await prisma.user.create({
        data: {
          organizationId,
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          name: [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.email,
          authMethod: 'SAML',
          samlNameId: profile.nameId,
          status: 'ACTIVE',
          emailVerified: true, // IdP already verified identity
          ...(connection.defaultRoleId ? { roleId: connection.defaultRoleId } : {}),
        },
        select: { id: true, email: true },
      })

      return { userId: newUser.id, email: newUser.email, provisioned: true }
    })

    if ('error' in result && result.error) {
      log.warn({ orgId: organizationId, error: result.error }, 'SAML login denied')
      return redirectWithError(appUrl, result.error as string)
    }

    // Issue JWT + set cookies (same as password login)
    const token = await signAuthToken({
      userId: result.userId,
      organizationId,
      email: result.email,
    })

    const csrfToken = crypto.randomUUID()
    const destination = redirectPath || '/dashboard'
    const redirectUrl = new URL(destination, appUrl)

    const response = NextResponse.redirect(redirectUrl.toString())
    response.cookies.set('auth-token', token, authCookieOptions())
    response.cookies.set('csrf-token', csrfToken, csrfCookieOptions())

    // Fire-and-forget audit log
    void audit({
      organizationId,
      userId: result.userId,
      userEmail: result.email,
      action: 'user.saml_login',
      resourceType: 'User',
      resourceId: result.userId,
      resourceLabel: result.email,
    })

    log.info(
      { orgId: organizationId, userId: result.userId, provisioned: 'provisioned' in result },
      'SAML login successful'
    )

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SAML callback failed'
    log.error({ err: error }, message)
    return redirectWithError(appUrl, 'validation_failed')
  }
}

function redirectWithError(appUrl: string, error: string): NextResponse {
  const loginUrl = new URL('/login', appUrl)
  loginUrl.searchParams.set('error', `sso_${error}`)
  return NextResponse.redirect(loginUrl.toString())
}
