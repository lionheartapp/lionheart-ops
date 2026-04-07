import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma, type OrgPrismaClient } from '@/lib/db'
import { createScheduleBlock } from '@/lib/services/eventProjectService'
import { CreateScheduleBlockSchema } from '@/lib/types/event-project'

/**
 * GET /api/events/projects/[id]/schedule
 *
 * Returns all schedule blocks for an EventProject, ordered by startsAt then sortOrder.
 */
export const GET = withAuth(async ({ params }) => {
  const db = prisma as unknown as OrgPrismaClient
  const blocks = await db.eventScheduleBlock.findMany({
    where: { eventProjectId: params.id },
    orderBy: [{ startsAt: 'asc' }, { sortOrder: 'asc' }],
    include: {
      lead: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  })
  return NextResponse.json(ok(blocks))
}, { permission: PERMISSIONS.EVENT_PROJECT_READ })

/**
 * POST /api/events/projects/[id]/schedule
 *
 * Creates a new schedule block within an EventProject.
 * Requires EVENT_PROJECT_UPDATE_ALL permission.
 */
export const POST = withAuth(async ({ params, ctx, body }) => {
  const block = await createScheduleBlock(params.id, body, ctx.userId)
  return NextResponse.json(ok(block), { status: 201 })
}, { permission: PERMISSIONS.EVENT_PROJECT_UPDATE_ALL, schema: CreateScheduleBlockSchema })
