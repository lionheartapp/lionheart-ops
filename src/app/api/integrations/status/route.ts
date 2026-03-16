import { NextRequest, NextResponse } from 'next/server'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { ok, fail } from '@/lib/api-response'
import { rawPrisma } from '@/lib/db'
import * as planningCenterService from '@/lib/services/integrations/planningCenterService'
import * as googleCalendarService from '@/lib/services/integrations/googleCalendarService'

/**
 * GET /api/integrations/status
 * Returns the connection status of all integrations for the current user/org.
 */
export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    return await runWithOrgContext(orgId, async () => {
      // Planning Center — org-level
      const pcoCred = await rawPrisma.integrationCredential.findFirst({
        where: { organizationId: orgId, provider: 'planning_center', isActive: true },
        select: { config: true, lastSyncAt: true },
      })

      const pcoConfig = pcoCred?.config as Record<string, string> | null

      // Google Calendar — per-user
      const gcalCred = await rawPrisma.integrationCredential.findFirst({
        where: { organizationId: orgId, userId: ctx.userId, provider: 'google_calendar', isActive: true },
        select: { config: true, lastSyncAt: true },
      })

      const gcalConfig = gcalCred?.config as Record<string, string> | null

      // Twilio — org-level
      const twilioCred = await rawPrisma.integrationCredential.findFirst({
        where: { organizationId: orgId, provider: 'twilio', isActive: true },
        select: { config: true, lastSyncAt: true },
      })

      const twilioConfig = twilioCred?.config as Record<string, string> | null

      return NextResponse.json(ok({
        planningCenter: {
          provider: 'planning_center',
          isAvailable: planningCenterService.isAvailable(),
          isConnected: !!(pcoCred && pcoConfig?.orgName !== undefined),
          lastSyncAt: pcoCred?.lastSyncAt || null,
          orgName: pcoConfig?.orgName || null,
        },
        googleCalendar: {
          provider: 'google_calendar',
          isAvailable: googleCalendarService.isAvailable(),
          isConnected: !!gcalCred,
          lastSyncAt: gcalCred?.lastSyncAt || null,
          userName: gcalConfig?.googleEmail || null,
        },
        twilio: {
          provider: 'twilio',
          isAvailable: !!(twilioConfig?.accountSid && twilioConfig?.phoneNumber),
          isConnected: !!(twilioCred && twilioConfig?.phoneNumber),
          lastSyncAt: twilioCred?.lastSyncAt || null,
          phoneNumber: twilioConfig?.phoneNumber || null,
        },
      }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
