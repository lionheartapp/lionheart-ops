/**
 * PATCH  /api/forms/qr/[id] — Toggle active, rename, or regenerate token
 * DELETE /api/forms/qr/[id] — Deactivate (soft-disable)
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { updateQrCode, deactivateQrCode, regenerateQrToken } from '@/lib/services/formQrService'
import { formQrCodeUpdateSchema } from '@/lib/forms/schemas'
import { invalidateOrgCache } from '@/lib/cache/route-cache'
import { z } from 'zod'

type RouteParams = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.FORMS_MANAGE)

    const { id } = await params
    const body = await req.json()

    // Check if this is a regenerate action
    if (body.regenerateToken === true) {
      return await runWithOrgContext(orgId, async () => {
        const qr = await regenerateQrToken(id)
        invalidateOrgCache(orgId, 'forms:qr')
        return NextResponse.json(ok(qr))
      })
    }

    const parsed = formQrCodeUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid update data', parsed.error.issues),
        { status: 400 }
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const qr = await updateQrCode(id, parsed.data)
      invalidateOrgCache(orgId, 'forms:qr')
      return NextResponse.json(ok(qr))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.FORMS_MANAGE)

    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      await deactivateQrCode(id)
      invalidateOrgCache(orgId, 'forms:qr')
      return NextResponse.json(ok({ deactivated: true }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
