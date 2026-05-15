/**
 * SAML SP Metadata — GET /api/auth/saml/metadata/:orgId
 *
 * Public endpoint. Returns the SP metadata XML that IdP administrators
 * import when configuring the SAML trust relationship.
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateSpMetadata } from '@/lib/services/samlService'
import { logger } from '@/lib/logger'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const log = logger.child({ route: '/api/auth/saml/metadata/[orgId]', method: 'GET' })

  try {
    const { orgId } = await params
    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: { code: 'BAD_REQUEST', message: 'orgId is required' } },
        { status: 400 }
      )
    }

    const xml = await generateSpMetadata(orgId)

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    log.error({ err: error }, 'Failed to generate SAML metadata')
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate metadata' } },
      { status: 500 }
    )
  }
}
