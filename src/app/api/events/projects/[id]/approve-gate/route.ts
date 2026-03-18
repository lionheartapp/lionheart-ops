import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { approveGate } from '@/lib/services/eventProjectService'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'

const log = logger.child({ route: '/api/events/projects/[id]/approve-gate' })

const schema = z.object({
  gateType: z.enum(['av', 'facilities', 'admin']),
})

type RouteParams = {
  params: Promise<{ id: string }>
}

/**
 * POST /api/events/projects/[id]/approve-gate
 *
 * Approves a specific approval gate (av, facilities, or admin) on an EventProject.
 * Admin gate can only be approved after AV/Facilities gates are cleared.
 * If all gates are approved, the event transitions to CONFIRMED.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    await assertCan(ctx.userId, PERMISSIONS.EVENT_PROJECT_APPROVE)

    const body = await req.json()
    const data = schema.parse(body)

    return await runWithOrgContext(orgId, async () => {
      const result = await approveGate(id, data.gateType, ctx.userId)
      return NextResponse.json(ok(result))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
    }
    if (error instanceof Error && (
      error.message.includes('Cannot approve') ||
      error.message.includes('No ') ||
      error.message.includes('Waiting on')
    )) {
      return NextResponse.json(fail('INVALID_STATE', error.message), { status: 400 })
    }
    log.error({ err: error }, 'Failed to approve gate')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 },
    )
  }
}
