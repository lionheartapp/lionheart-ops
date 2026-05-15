/**
 * SAML SSO Status — GET /api/auth/saml/status
 *
 * Public endpoint (used by the login page before auth).
 * Returns whether SAML SSO is enabled for the given organization.
 *
 * Query params:
 *   organizationId — required
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSamlConnection } from '@/lib/services/samlService'
import { ok } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  const organizationId = req.nextUrl.searchParams.get('organizationId')

  if (!organizationId) {
    return NextResponse.json(ok({ enabled: false }))
  }

  const connection = await getSamlConnection(organizationId)
  return NextResponse.json(ok({ enabled: connection?.enabled ?? false }))
}
