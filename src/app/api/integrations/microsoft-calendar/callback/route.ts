import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/db'
import * as microsoftCalendarService from '@/lib/services/integrations/microsoftCalendarService'

/**
 * GET /api/integrations/microsoft-calendar/callback
 * OAuth callback from Microsoft — exchanges code for tokens, redirects to the tenant's settings.
 * The `state` param encodes { userId, origin } so we redirect to the correct subdomain.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const stateParam = searchParams.get('state')
  const error = searchParams.get('error')

  const { userId, origin } = stateParam
    ? microsoftCalendarService.decodeOAuthState(stateParam)
    : { userId: '', origin: '' }

  const baseUrl = origin || process.env.NEXT_PUBLIC_APP_URL || ''
  const settingsUrl = `${baseUrl}/settings`

  if (error || !code || !userId) {
    return NextResponse.redirect(
      `${settingsUrl}?tab=integrations&mscal_error=${encodeURIComponent(error || 'Missing code or state')}`
    )
  }

  try {
    const user = await rawPrisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { organizationId: true },
    })

    if (!user) {
      return NextResponse.redirect(`${settingsUrl}?tab=integrations&mscal_error=User+not+found`)
    }

    const result = await microsoftCalendarService.handleCallback(userId, user.organizationId, code)

    if (!result.success) {
      return NextResponse.redirect(
        `${settingsUrl}?tab=integrations&mscal_error=${encodeURIComponent(result.error || 'Connection failed')}`
      )
    }

    return NextResponse.redirect(`${settingsUrl}?tab=integrations&mscal_connected=1`)
  } catch {
    return NextResponse.redirect(`${settingsUrl}?tab=integrations&mscal_error=Internal+error`)
  }
}
