import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const CreateCommentSchema = z.object({
  message: z.string().trim().min(1).max(5000),
})

/** GET — list all comments on a conflict */
export const GET = withAuth(async ({ params }) => {
  const comments = await prisma.planningConflictComment.findMany({
    where: { planningConflictId: params.conflictId },
    orderBy: { createdAt: 'asc' },
    include: {
      author: {
        select: { id: true, firstName: true, lastName: true, avatar: true },
      },
    },
  })
  return NextResponse.json(ok(comments))
}, { permission: PERMISSIONS.PLANNING_VIEW })

/** POST — add a comment to a conflict thread */
export const POST = withAuth(async ({ params, ctx, body }) => {
  const comment = await prisma.planningConflictComment.create({
    data: {
      planningConflictId: params.conflictId,
      authorId: ctx.userId,
      message: body.message,
    },
    include: {
      author: {
        select: { id: true, firstName: true, lastName: true, avatar: true },
      },
    },
  })
  return NextResponse.json(ok(comment), { status: 201 })
}, { permission: PERMISSIONS.PLANNING_COMMENT, schema: CreateCommentSchema })
