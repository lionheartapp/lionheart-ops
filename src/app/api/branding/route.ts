/**
 * Public Branding API
 * Returns organization branding for subdomain-based login page customization
 * No authentication required (public endpoint)
 */

import { NextRequest, NextResponse } from 'next/server'
import { organizationService } from '@/lib/services'
import { ok, fail } from '@/lib/api-response'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

export async function GET(req: NextRequest) {
  const log = logger.child({ route: '/api/branding', method: 'GET' })
  try {
    // Get subdomain from middleware-injected header
    const subdomain = req.headers.get('x-org-subdomain')
    
    if (!subdomain) {
      return NextResponse.json(
        fail('BAD_REQUEST', 'No subdomain provided'),
        { status: 400 }
      )
    }

    const branding = await organizationService.getOrganizationBranding(subdomain)

    if (!branding) {
      return NextResponse.json(
        fail('NOT_FOUND', 'Organization not found'),
        { status: 404 }
      )
    }

    return NextResponse.json(ok(branding))
  } catch (error) {
    log.error({ err: error }, 'Branding fetch error')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to fetch organization branding'),
      { status: 500 }
    )
  }
}
