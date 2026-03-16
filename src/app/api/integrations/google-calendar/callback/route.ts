import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/db'
import { verifyAuthToken } from '@/lib/auth'
import * as googleCalendarService from '@/lib/services/integrations/googleCalendarService'

/**
 * GET /api/integrations/google-calendar/callback
 * Handles OAuth callback from Google — redirects to settings page.
 * The `state` param carries the userId. We look up the org from the JWT cookie.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // userId
  const error = searchParams.get('error')

  const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || ''
  const settingsUrl = `${appUrl}/settings`

  if (error || !code || !state) {
    return NextResponse.redirect(
      `${settingsUrl}?tab=integrations&gcal_error=${encodeURIComponent(error || 'Missing code or state')}`
    )
  }

  // Resolve organizationId from the user record
  try {
    const user = await rawPrisma.user.findFirst({
      where: { id: state, deletedAt: null },
      select: { organizationId: true },
    })

    if (!user) {
      return NextResponse.redirect(`${settingsUrl}?tab=integrations&gcal_error=User+not+found`)
    }

    const result = await googleCalendarService.handleCallback(state, user.organizationId, code)

    if (!result.success) {
      return NextResponse.redirect(
        `${settingsUrl}?tab=integrations&gcal_error=${encodeURIComponent(result.error || 'Connection failed')}`
      )
    }

    return NextResponse.redirect(`${settingsUrl}?tab=integrations&gcal_connected=1`)
  } catch {
    return NextResponse.redirect(`${settingsUrl}?tab=integrations&gcal_error=Internal+error`)
  }
}
