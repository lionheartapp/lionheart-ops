/**
 * GET  /api/forms/qr — List QR codes for the org
 * POST /api/forms/qr — Create a new QR code
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { listQrCodes, createQrCode } from '@/lib/services/formQrService'
import { formQrCodeCreateSchema } from '@/lib/forms/schemas'
import { cacheOrgWide, invalidateOrgCache } from '@/lib/cache/route-cache'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.FORMS_MANAGE)

    return await runWithOrgContext(orgId, async () => {
      const codes = await cacheOrgWide(
        orgId,
        'forms:qr:list',
        () => listQrCodes(),
        { ttlMs: 60000 }
      )
      return NextResponse.json(ok(codes))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.FORMS_MANAGE)

    const body = await req.json()
    const parsed = formQrCodeCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid QR code data', parsed.error.issues),
        { status: 400 }
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const qr = await createQrCode(parsed.data)
      invalidateOrgCache(orgId, 'forms:qr')
      return NextResponse.json(ok(qr), { status: 201 })
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
