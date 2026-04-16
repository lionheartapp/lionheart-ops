import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/db'
import * as microsoftCalendarService from '@/lib/services/integrations/microsoftCalendarService'

/**
 * GET /api/integrations/microsoft-calendar/callback
 * OAuth callback from Microsoft — exchanges code for tokens, redirects to settings.
 * The `state` param carries the userId.
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
      `${settingsUrl}?tab=integrations&mscal_error=${encodeURIComponent(error || 'Missing code or state')}`
    )
  }

  try {
    const user = await rawPrisma.user.findFirst({
      where: { id: state, deletedAt: null },
      select: { organizationId: true },
    })

    if (!user) {
      return NextResponse.redirect(`${settingsUrl}?tab=integrations&mscal_error=User+not+found`)
    }

    const result = await microsoftCalendarService.handleCallback(state, user.organizationId, code)

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
