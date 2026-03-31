import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getComments, addComment } from '@/lib/services/planningSeasonService'
import { z } from 'zod'

const CreateCommentSchema = z.object({
  message: z.string().trim().min(1).max(5000),
  isAdminOnly: z.boolean().optional(),
})

export const GET = withAuth(async ({ params }) => {
  const comments = await getComments(params.subId)
  return NextResponse.json(ok(comments))
}, { permission: PERMISSIONS.PLANNING_VIEW })

export const POST = withAuth(async ({ params, ctx, body }) => {
  const comment = await addComment({
    planningSubmissionId: params.subId,
    authorId: ctx.userId,
    ...body,
  })
  return NextResponse.json(ok(comment), { status: 201 })
}, { permission: PERMISSIONS.PLANNING_COMMENT, schema: CreateCommentSchema })
