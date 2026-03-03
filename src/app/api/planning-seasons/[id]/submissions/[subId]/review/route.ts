import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { reviewSubmission } from '@/lib/services/planningSeasonService'

const ReviewSchema = z.object({
  status: z.enum(['APPROVED_IN_PRINCIPLE', 'NEEDS_REVISION', 'DECLINED', 'APPROVED']),
  adminNotes: z.string().optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; subId: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()
    await assertCan(ctx.userId, PERMISSIONS.PLANNING_REVIEW)
    const { subId } = await params

    return await runWithOrgContext(orgId, async () => {
      const input = ReviewSchema.parse(body)
      const submission = await reviewSubmission(subId, input)
      return NextResponse.json(ok(submission))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to review submission'), { status: 500 })
  }
}
