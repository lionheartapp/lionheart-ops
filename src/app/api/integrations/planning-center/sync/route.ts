import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { ok, fail } from '@/lib/api-response'
import * as planningCenterService from '@/lib/services/integrations/planningCenterService'

const SyncBodySchema = z.object({
  action: z.enum(['people', 'services', 'checkins']),
  eventProjectId: z.string().optional(),
})

/**
 * POST /api/integrations/planning-center/sync
 * Triggers a Planning Center sync action.
 * Body: { action: 'people' | 'services' | 'checkins', eventProjectId?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.INTEGRATIONS_MANAGE)

    const body = await req.json()
    const parsed = SyncBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid request body', parsed.error.issues), { status: 400 })
    }

    if (!planningCenterService.isAvailable()) {
      return NextResponse.json(
        fail('SERVICE_UNAVAILABLE', 'Planning Center API credentials are not configured.'),
        { status: 503 }
      )
    }

    const { action, eventProjectId } = parsed.data

    return await runWithOrgContext(orgId, async () => {
      let result

      switch (action) {
        case 'people':
          result = await planningCenterService.syncPeople(orgId)
          break
        case 'services':
          result = await planningCenterService.syncServices(orgId)
          break
        case 'checkins':
          if (!eventProjectId) {
            return NextResponse.json(
              fail('VALIDATION_ERROR', 'eventProjectId is required for check-in sync'),
              { status: 400 }
            )
          }
          result = await planningCenterService.pushCheckIns(orgId, eventProjectId)
          break
      }

      return NextResponse.json(ok({ action, result }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

/**
 * DELETE /api/integrations/planning-center/sync
 * Disconnects the Planning Center integration.
 */
export async function DELETE(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.INTEGRATIONS_MANAGE)

    await planningCenterService.disconnect(orgId)
    return NextResponse.json(ok({ disconnected: true }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
