import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { prisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { UpdateScheduleSectionSchema } from '@/lib/types/event-project'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const log = logger.child({ route: '/api/events/projects/[id]/schedule/sections/[sectionId]' })

type RouteParams = {
  params: Promise<{ id: string; sectionId: string }>
}

/**
 * PATCH /api/events/projects/[id]/schedule/sections/[sectionId]
 *
 * Updates a schedule section (title, sortOrder).
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id, sectionId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    await assertCan(ctx.userId, PERMISSIONS.EVENT_PROJECT_UPDATE_ALL)

    const body = await req.json()

    return await runWithOrgContext(orgId, async () => {
      const validated = UpdateScheduleSectionSchema.parse(body)
      const db = prisma as any

      const section = await db.eventScheduleSection.update({
        where: { id: sectionId },
        data: validated,
      })
      return NextResponse.json(ok(section))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error }, 'Failed to update schedule section')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 },
    )
  }
}

/**
 * DELETE /api/events/projects/[id]/schedule/sections/[sectionId]
 *
 * Deletes a schedule section. Blocks in the section are unassigned (sectionId → null).
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id, sectionId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    await assertCan(ctx.userId, PERMISSIONS.EVENT_PROJECT_UPDATE_ALL)

    return await runWithOrgContext(orgId, async () => {
      const db = prisma as any

      // Unassign all blocks from this section first
      await db.eventScheduleBlock.updateMany({
        where: { sectionId, eventProjectId: id },
        data: { sectionId: null },
      })

      // Delete the section
      await db.eventScheduleSection.delete({
        where: { id: sectionId },
      })

      return NextResponse.json(ok({ deleted: true }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error }, 'Failed to delete schedule section')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 },
    )
  }
}
