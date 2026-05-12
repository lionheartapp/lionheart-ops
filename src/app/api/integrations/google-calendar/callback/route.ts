import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/db'
import { invalidateUserCache } from '@/lib/cache/route-cache'
import * as googleCalendarService from '@/lib/services/integrations/googleCalendarService'
import { isAllowedOrigin } from '@/lib/services/integrations/oauth-state'

/**
 * GET /api/integrations/google-calendar/callback
 * Handles OAuth callback from Google — redirects to the tenant's settings page.
 * The `state` param is HMAC-signed to prevent CSRF and open-redirect attacks.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const stateParam = searchParams.get('state')
  const error = searchParams.get('error')

  // Decode and verify the signed state
  const { userId, origin } = stateParam
    ? googleCalendarService.decodeOAuthState(stateParam)
    : { userId: '', origin: '' }

  // Validate redirect origin to prevent open redirects
  const safeOrigin = origin && isAllowedOrigin(origin) ? origin : ''
  const baseUrl = safeOrigin || process.env.NEXT_PUBLIC_APP_URL || ''
  const settingsUrl = `${baseUrl}/settings`

  if (error || !code || !userId) {
    return NextResponse.redirect(
      `${settingsUrl}?tab=integrations&gcal_error=${encodeURIComponent(error || 'Missing code or state')}`
    )
  }

  try {
    const user = await rawPrisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { organizationId: true },
    })

    if (!user) {
      return NextResponse.redirect(`${settingsUrl}?tab=integrations&gcal_error=User+not+found`)
    }

    const result = await googleCalendarService.handleCallback(userId, user.organizationId, code)

    if (!result.success) {
      return NextResponse.redirect(
        `${settingsUrl}?tab=integrations&gcal_error=${encodeURIComponent(result.error || 'Connection failed')}`
      )
    }

    invalidateUserCache(userId, 'integrations')
    return NextResponse.redirect(`${settingsUrl}?tab=integrations&gcal_connected=1`)
  } catch {
    return NextResponse.redirect(`${settingsUrl}?tab=integrations&gcal_error=Internal+error`)
  }
}
