import { NextRequest, NextResponse } from 'next/server'
import * as planningCenterService from '@/lib/services/integrations/planningCenterService'

/**
 * GET /api/integrations/planning-center/callback
 * Handles OAuth callback from Planning Center — redirects to settings page.
 * This is a public redirect endpoint; the `state` param carries the orgId.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // organizationId
  const error = searchParams.get('error')

  const settingsUrl = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || ''}/settings`

  if (error || !code || !state) {
    return NextResponse.redirect(`${settingsUrl}?tab=integrations&pco_error=${encodeURIComponent(error || 'Missing code or state')}`)
  }

  const result = await planningCenterService.handleCallback(state, code)

  if (!result.success) {
    return NextResponse.redirect(`${settingsUrl}?tab=integrations&pco_error=${encodeURIComponent(result.error || 'Connection failed')}`)
  }

  return NextResponse.redirect(`${settingsUrl}?tab=integrations&pco_connected=1`)
}
