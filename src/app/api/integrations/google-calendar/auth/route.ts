import { NextRequest, NextResponse } from 'next/server'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { ok, fail } from '@/lib/api-response'
import * as googleCalendarService from '@/lib/services/integrations/googleCalendarService'

/**
 * GET /api/integrations/google-calendar/auth
 * Returns the per-user Google Calendar OAuth authorization URL.
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.INTEGRATIONS_GOOGLE_CALENDAR)

    if (!googleCalendarService.isAvailable()) {
      return NextResponse.json(
        fail('SERVICE_UNAVAILABLE', 'Google Calendar credentials are not configured. Contact your administrator.'),
        { status: 503 }
      )
    }

    // Pass the tenant's origin so the callback can redirect back to the correct subdomain
    const host = req.headers.get('host') || ''
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const tenantOrigin = `${protocol}://${host}`

    const authUrl = googleCalendarService.getAuthUrl(ctx.userId, tenantOrigin)
    return NextResponse.json(ok({ authUrl }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', 'You do not have permission to perform this action'), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
