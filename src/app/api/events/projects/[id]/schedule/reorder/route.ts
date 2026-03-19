import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { rawPrisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const log = logger.child({ route: '/api/events/projects/[id]/schedule/reorder' })

const ReorderSchema = z.object({
  /** Ordered list of block IDs — index becomes the new sortOrder */
  blockIds: z.array(z.string().uuid()).min(1),
})

type RouteParams = {
  params: Promise<{ id: string }>
}

/**
 * PATCH /api/events/projects/[id]/schedule/reorder
 *
 * Accepts an ordered array of block IDs and updates their sortOrder accordingly.
 * Uses a transaction to ensure atomic reordering.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: eventProjectId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    await assertCan(ctx.userId, PERMISSIONS.EVENT_PROJECT_UPDATE_ALL)

    const body = await req.json()
    const { blockIds } = ReorderSchema.parse(body)

    return await runWithOrgContext(orgId, async () => {
      // Use rawPrisma for the batch transaction
      const updates = blockIds.map((blockId, index) =>
        rawPrisma.eventScheduleBlock.update({
          where: { id: blockId },
          data: { sortOrder: index },
        })
      )

      await rawPrisma.$transaction(updates)

      return NextResponse.json(ok({ reordered: blockIds.length }))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error }, 'Failed to reorder schedule blocks')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 },
    )
  }
}
