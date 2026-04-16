import { NextRequest, NextResponse } from 'next/server'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { ok, fail } from '@/lib/api-response'
import * as microsoftCalendarService from '@/lib/services/integrations/microsoftCalendarService'

export async function GET(req: NextRequest) {
  try {
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.INTEGRATIONS_GOOGLE_CALENDAR) // same perm covers both calendar providers

    if (!microsoftCalendarService.isAvailable()) {
      return NextResponse.json(
        fail('SERVICE_UNAVAILABLE', 'Microsoft Calendar credentials are not configured. Contact your administrator.'),
        { status: 503 }
      )
    }

    const authUrl = microsoftCalendarService.getAuthUrl(ctx.userId)
    return NextResponse.json(ok({ authUrl }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', 'You do not have permission to perform this action'), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
