/**
 * POST /api/it/erate/documentation-package — generate E-Rate documentation PDF
 */

import { NextResponse } from 'next/server'
import { fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { generateERateDocPackage } from '@/lib/services/itERateService'

export const POST = withAuth(async ({ req, orgId }) => {
  const body = await req.json()
  const { schoolYear } = body as { schoolYear: string }

  if (!schoolYear || !/^\d{4}-\d{4}$/.test(schoolYear)) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'schoolYear must be in format YYYY-YYYY'),
      { status: 400 }
    )
  }

  const pdfBuffer = await generateERateDocPackage(orgId, schoolYear)

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="erate-documentation-${schoolYear}.pdf"`,
    },
  })
}, { permission: PERMISSIONS.IT_ERATE_MANAGE })
