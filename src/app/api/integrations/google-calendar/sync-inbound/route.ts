import { NextRequest, NextResponse } from 'next/server'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { ok, fail } from '@/lib/api-response'
import * as googleCalendarService from '@/lib/services/integrations/googleCalendarService'

/**
 * POST /api/integrations/google-calendar/sync-inbound
 *
 * Pulls events from the authenticated user's Google Calendar into the
 * ExternalCalendarEvent table. Returns a summary the UI can render as
 * a success toast.
 *
 * Auth: requires the INTEGRATIONS_GOOGLE_CALENDAR permission (same as the
 * existing outbound sync endpoint). The user must have already completed
 * the Google OAuth flow.
 */
export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.INTEGRATIONS_GOOGLE_CALENDAR)

    if (!googleCalendarService.isAvailable()) {
      return NextResponse.json(
        fail('SERVICE_UNAVAILABLE', 'Google Calendar credentials are not configured.'),
        { status: 503 }
      )
    }

    const result = await googleCalendarService.importEventsFromGoogleCalendar(ctx.userId, orgId)

    if (result.error) {
      // 422 when we understand the failure (e.g. no active connection) —
      // the client should surface the message rather than a generic 500.
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
