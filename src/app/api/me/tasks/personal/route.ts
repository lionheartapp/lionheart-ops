import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { prisma } from '@/lib/db'
import { withAuth } from '@/lib/api/with-auth'
import { CreatePersonalTaskSchema } from '@/lib/types/personal-task'

/**
 * GET /api/me/tasks/personal
 *
 * List the current user's personal tasks (not event tasks).
 * Optional query: ?status=TODO|IN_PROGRESS|BLOCKED|DONE
 */
export const GET = withAuth(async ({ ctx, searchParams }) => {
  const status = searchParams.get('status') ?? undefined
  const tasks = await prisma.task.findMany({
    where: {
      userId: ctx.userId,
      ...(status ? { status: status as 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' } : {}),
    },
    orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json(ok(tasks))
})

/**
 * POST /api/me/tasks/personal
 *
 * Create a personal task for the current user.
 */
export const POST = withAuth(async ({ ctx, body }) => {
  const task = await prisma.task.create({
    data: {
      userId: ctx.userId,
      title: body.title,
      description: body.description,
      priority: body.priority,
      dueDate: body.dueDate,
    },
  })
  return NextResponse.json(ok(task), { status: 201 })
}, { schema: CreatePersonalTaskSchema })
