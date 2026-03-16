import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { ok, fail } from '@/lib/api-response'
import { prisma } from '@/lib/db'
import * as googleCalendarService from '@/lib/services/integrations/googleCalendarService'

const SyncBodySchema = z.object({
  eventProjectId: z.string().min(1, 'eventProjectId is required'),
})

/**
 * POST /api/integrations/google-calendar/sync
 * Syncs a specific EventProject to the current user's Google Calendar.
 * Body: { eventProjectId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.INTEGRATIONS_GOOGLE_CALENDAR)

    const body = await req.json()
    const parsed = SyncBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid request body', parsed.error.issues), { status: 400 })
    }

    if (!googleCalendarService.isAvailable()) {
      return NextResponse.json(
        fail('SERVICE_UNAVAILABLE', 'Google Calendar credentials are not configured.'),
        { status: 503 }
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const eventProject = await (prisma as any).eventProject.findFirst({
        where: { id: parsed.data.eventProjectId },
      })

      if (!eventProject) {
        return NextResponse.json(fail('NOT_FOUND', 'Event project not found'), { status: 404 })
      }

      const result = await googleCalendarService.syncEventToCalendar(
        ctx.userId,
        orgId,
        eventProject
      )

      if (!result) {
        return NextResponse.json(
          fail('SYNC_FAILED', 'Could not sync to Google Calendar. Make sure your account is connected.'),
          { status: 422 }
        )
      }

      return NextResponse.json(ok({ synced: true, googleEventId: result.googleEventId, htmlLink: result.htmlLink }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

/**
 * DELETE /api/integrations/google-calendar/sync
 * Disconnects the user's Google Calendar integration.
 */
export async function DELETE(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.INTEGRATIONS_GOOGLE_CALENDAR)

    await googleCalendarService.disconnect(ctx.userId, orgId)
    return NextResponse.json(ok({ disconnected: true }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
