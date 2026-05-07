import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { prisma } from '@/lib/db'
import { withAuth } from '@/lib/api/with-auth'
import { CreatePersonalTaskSchema } from '@/lib/types/personal-task'

/**
 * GET /api/me/tasks/personal
 *
 * List the current user's top-level personal tasks (not subtasks).
 * Includes subtasks nested in each task.
 * Optional query: ?status=TODO|IN_PROGRESS|BLOCKED|DONE
 */
export const GET = withAuth(async ({ ctx, searchParams }) => {
  const status = searchParams.get('status') ?? undefined
  const tasks = await prisma.task.findMany({
    where: {
      userId: ctx.userId,
      parentId: null,
      ...(status ? { status: status as 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' } : {}),
    },
    include: {
      subtasks: {
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json(ok(tasks))
})

/**
 * POST /api/me/tasks/personal
 *
 * Create a personal task (or subtask if parentId is provided).
 */
export const POST = withAuth(async ({ ctx, orgId, body }) => {
  const task = await prisma.task.create({
    data: {
      organizationId: orgId,
      userId: ctx.userId,
      title: body.title,
      description: body.description,
      priority: body.priority,
      dueDate: body.dueDate,
      parentId: body.parentId,
    },
    include: {
      subtasks: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  return NextResponse.json(ok(task), { status: 201 })
}, { schema: CreatePersonalTaskSchema })
