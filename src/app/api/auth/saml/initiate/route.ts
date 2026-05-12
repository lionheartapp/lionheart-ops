/**
 * SAML SP-Initiated Login — GET /api/auth/saml/initiate
 *
 * Public endpoint (no auth required). Redirects the browser to the
 * organization's configured IdP SSO URL with a signed AuthnRequest.
 *
 * Query params:
 *   organizationId — required, identifies which SAML config to use
 *   redirect       — optional, path to redirect to after login (e.g. /dashboard)
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateLoginUrl } from '@/lib/services/samlService'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  const log = logger.child({ route: '/api/auth/saml/initiate', method: 'GET' })

  try {
    const organizationId = req.nextUrl.searchParams.get('organizationId')
    const redirect = req.nextUrl.searchParams.get('redirect') || undefined

    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: { code: 'BAD_REQUEST', message: 'organizationId is required' } },
        { status: 400 }
      )
    }

    const loginUrl = await generateLoginUrl(organizationId, redirect)
    return NextResponse.redirect(loginUrl)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SAML initiation failed'
    log.error({ err: error }, message)

    // Redirect back to login with error instead of showing raw JSON
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3004'
    const loginUrl = new URL('/login', appUrl)
    loginUrl.searchParams.set('error', 'sso_config')
    return NextResponse.redirect(loginUrl.toString())
  }
}
