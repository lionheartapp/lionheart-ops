import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { submitSubmission } from '@/lib/services/planningSeasonService'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; subId: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.PLANNING_SUBMIT)
    const { subId } = await params

    return await runWithOrgContext(orgId, async () => {
      const submission = await submitSubmission(subId)
      return NextResponse.json(ok(submission))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to submit submission'), { status: 500 })
  }
}
