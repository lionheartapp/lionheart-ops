import { NextRequest, NextResponse } from 'next/server'
import { fail } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { generateERateDocPackage } from '@/lib/services/itERateService'

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_ERATE_MANAGE)

    const body = await req.json()
    const { schoolYear } = body as { schoolYear: string }

    if (!schoolYear || !/^\d{4}-\d{4}$/.test(schoolYear)) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'schoolYear must be in format YYYY-YYYY'),
        { status: 400 }
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const pdfBuffer = await generateERateDocPackage(orgId, schoolYear)
      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="erate-documentation-${schoolYear}.pdf"`,
        },
      })
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Failed to generate E-Rate documentation package:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
