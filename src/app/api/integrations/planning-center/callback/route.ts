import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/db'
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

  // Build the redirect URL back to the correct tenant subdomain
  const settingsUrl = await buildSettingsUrl(req, state)

  if (error || !code || !state) {
    return NextResponse.redirect(`${settingsUrl}?tab=integrations&pco_error=${encodeURIComponent(error || 'Missing code or state')}`)
  }

  const result = await planningCenterService.handleCallback(state, code)

  if (!result.success) {
    return NextResponse.redirect(`${settingsUrl}?tab=integrations&pco_error=${encodeURIComponent(result.error || 'Connection failed')}`)
  }

  return NextResponse.redirect(`${settingsUrl}?tab=integrations&pco_connected=1`)
}

/**
 * Builds the settings URL using the tenant's subdomain so the redirect
 * lands on the correct host where the auth cookie lives.
 */
async function buildSettingsUrl(req: NextRequest, orgId: string | null): Promise<string> {
  // Try to resolve the org's slug for subdomain routing
  if (orgId) {
    try {
      const org = await rawPrisma.organization.findUnique({
        where: { id: orgId },
        select: { slug: true },
      })

      if (org?.slug) {
        const host = req.headers.get('host') || ''
        const protocol = host.includes('localhost') ? 'http' : 'https'

        // Local dev: slug.localhost:3004
        if (host.includes('localhost')) {
          const port = host.split(':')[1] || '3004'
          return `${protocol}://${org.slug}.localhost:${port}/settings`
        }

        // Production: slug.lionheartapp.com
        const baseDomain = process.env.NEXT_PUBLIC_LIONHEART_URL
          ? new URL(process.env.NEXT_PUBLIC_LIONHEART_URL).hostname.replace(/^[^.]+\./, '')
          : 'lionheartapp.com'
        return `${protocol}://${org.slug}.${baseDomain}/settings`
      }
    } catch {
      // Fall through to default
    }
  }

  // Fallback: use the app URL
  return `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || ''}/settings`
}
