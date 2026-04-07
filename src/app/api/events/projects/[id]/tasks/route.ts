import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma, type OrgPrismaClient } from '@/lib/db'
import { createEventTask } from '@/lib/services/eventProjectService'
import { CreateEventTaskSchema } from '@/lib/types/event-project'

/**
 * GET /api/events/projects/[id]/tasks
 *
 * Returns all tasks for an EventProject.
 * Optional filters: status, assigneeId
 * Ordered by dueDate ascending (nulls last), then priority descending.
 */
export const GET = withAuth(async ({ params, searchParams }) => {
  const status = searchParams.get('status') ?? undefined
  const assigneeId = searchParams.get('assigneeId') ?? undefined

  const db = prisma as unknown as OrgPrismaClient
  const tasks = await db.eventTask.findMany({
    where: {
      eventProjectId: params.id,
      ...(status ? { status } : {}),
      ...(assigneeId ? { assigneeId } : {}),
    },
    orderBy: [
      { dueDate: 'asc' },
      { priority: 'desc' },
    ],
    include: {
      assignee: { select: { id: true, firstName: true, lastName: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  })
  return NextResponse.json(ok(tasks))
}, { permission: PERMISSIONS.EVENT_PROJECT_READ })

/**
 * POST /api/events/projects/[id]/tasks
 *
 * Creates a new task within an EventProject.
 * Requires EVENT_PROJECT_UPDATE_ALL permission.
 */
export const POST = withAuth(async ({ params, ctx, body }) => {
  const task = await createEventTask(params.id, body, ctx.userId)
  return NextResponse.json(ok(task), { status: 201 })
}, { permission: PERMISSIONS.EVENT_PROJECT_UPDATE_ALL, schema: CreateEventTaskSchema })
