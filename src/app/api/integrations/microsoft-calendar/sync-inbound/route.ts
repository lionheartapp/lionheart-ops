import { NextRequest, NextResponse } from 'next/server'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { ok, fail } from '@/lib/api-response'
import * as microsoftCalendarService from '@/lib/services/integrations/microsoftCalendarService'

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.INTEGRATIONS_GOOGLE_CALENDAR)

    if (!microsoftCalendarService.isAvailable()) {
      return NextResponse.json(
        fail('SERVICE_UNAVAILABLE', 'Microsoft Calendar credentials are not configured.'),
        { status: 503 }
      )
    }

    const result = await microsoftCalendarService.importEventsFromMicrosoftCalendar(ctx.userId, orgId)

    if (result.error) {
      return NextResponse.json(fail('SYNC_FAILED', result.error), { status: 422 })
    }

    return NextResponse.json(ok({
      imported: result.imported,
      deleted: result.deleted,
      syncedAt: new Date().toISOString(),
    }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', 'You do not have permission to perform this action'), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.INTEGRATIONS_GOOGLE_CALENDAR)

    await microsoftCalendarService.disconnect(ctx.userId, orgId)
    return NextResponse.json(ok({ disconnected: true }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', 'You do not have permission to perform this action'), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
