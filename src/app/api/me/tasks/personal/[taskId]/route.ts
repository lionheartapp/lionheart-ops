import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { prisma } from '@/lib/db'
import { withAuth } from '@/lib/api/with-auth'
import { UpdatePersonalTaskSchema } from '@/lib/types/personal-task'

/**
 * PATCH /api/me/tasks/personal/:taskId
 *
 * Update a personal task. Only the owner can update their own tasks.
 */
export const PATCH = withAuth(async ({ ctx, params, body }) => {
  const existing = await prisma.task.findFirst({
    where: { id: params.taskId, userId: ctx.userId },
  })
  if (!existing) {
    return NextResponse.json(fail('NOT_FOUND', 'Task not found'), { status: 404 })
  }

  // Auto-manage completedAt based on status transitions
  const data: Record<string, unknown> = { ...body }
  if (body.status === 'DONE' && existing.status !== 'DONE') {
    data.completedAt = new Date()
  } else if (body.status && body.status !== 'DONE' && existing.status === 'DONE') {
    data.completedAt = null
  }

  const updated = await prisma.task.update({
    where: { id: params.taskId },
    data,
    include: {
      subtasks: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  return NextResponse.json(ok(updated))
}, { schema: UpdatePersonalTaskSchema })

/**
 * DELETE /api/me/tasks/personal/:taskId
 *
 * Soft-delete a personal task. Only the owner can delete their own tasks.
 * Cascade deletes subtasks via the Prisma relation.
 */
export const DELETE = withAuth(async ({ ctx, params }) => {
  const existing = await prisma.task.findFirst({
    where: { id: params.taskId, userId: ctx.userId },
  })
  if (!existing) {
    return NextResponse.json(fail('NOT_FOUND', 'Task not found'), { status: 404 })
  }

  await prisma.task.delete({ where: { id: params.taskId } })
  return NextResponse.json(ok({ deleted: true }))
})
