import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getComments, addComment } from '@/lib/services/planningSeasonService'

const CreateCommentSchema = z.object({
  message: z.string().trim().min(1).max(5000),
  isAdminOnly: z.boolean().optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; subId: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.PLANNING_VIEW)
    const { subId } = await params

    return await runWithOrgContext(orgId, async () => {
      const comments = await getComments(subId)
      return NextResponse.json(ok(comments))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch comments'), { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; subId: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()
    await assertCan(ctx.userId, PERMISSIONS.PLANNING_COMMENT)
    const { subId } = await params

    return await runWithOrgContext(orgId, async () => {
      const input = CreateCommentSchema.parse(body)
      const comment = await addComment({
        planningSubmissionId: subId,
        authorId: ctx.userId,
        ...input,
      })
      return NextResponse.json(ok(comment), { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to add comment'), { status: 500 })
  }
}
