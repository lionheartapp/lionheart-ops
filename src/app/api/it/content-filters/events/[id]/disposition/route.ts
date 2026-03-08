import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { updateEventDisposition } from '@/lib/services/itContentFilterService'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_FILTERS_MANAGE)

    const { id } = await params
    const body = await req.json()
    const { disposition, notes } = body as { disposition: string; notes?: string }

    if (!disposition || !['APPROVED', 'DENIED', 'ESCALATED'].includes(disposition)) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'disposition must be APPROVED, DENIED, or ESCALATED'),
        { status: 400 }
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const updated = await updateEventDisposition(orgId, id, ctx.userId, { disposition, notes })
      return NextResponse.json(ok(updated))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
    }
    console.error('Failed to update event disposition:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
