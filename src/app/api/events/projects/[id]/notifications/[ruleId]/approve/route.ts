/**
 * POST /api/events/projects/[id]/notifications/[ruleId]/approve
 *
 * Submit, approve, or cancel a notification rule.
 * Body: { action: 'submit' | 'approve' | 'cancel' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { ok, fail } from '@/lib/api-response'
import {
  submitForApproval,
  approveRule,
  cancelRule,
} from '@/lib/services/notificationOrchestrationService'

const ApproveActionSchema = z.object({
  action: z.enum(['submit', 'approve', 'cancel']),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  try {
    const { ruleId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_NOTIFICATIONS_MANAGE)

    const body = await req.json()
    const parsed = ApproveActionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'action must be one of: submit, approve, cancel'),
        { status: 400 }
      )
    }

    const { action } = parsed.data

    return await runWithOrgContext(orgId, async () => {
      let updated

      if (action === 'submit') {
        updated = await submitForApproval(ruleId)
      } else if (action === 'approve') {
        updated = await approveRule(ruleId, ctx.userId)
      } else {
        updated = await cancelRule(ruleId)
      }

      return NextResponse.json(ok(updated))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
    }
    if (
      error instanceof Error &&
      (error.message.includes('Cannot submit') ||
        error.message.includes('Cannot approve') ||
        error.message.includes('Cannot cancel') ||
        error.message.includes('in the past'))
    ) {
      return NextResponse.json(fail('CONFLICT', error.message), { status: 409 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
