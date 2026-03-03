import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import * as notificationService from '@/lib/services/notificationService'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      const updated = await notificationService.markAsRead(id, ctx.userId)
      if (!updated) {
        return NextResponse.json(fail('NOT_FOUND', 'Notification not found'), { status: 404 })
      }
      return NextResponse.json(ok({ read: true }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
