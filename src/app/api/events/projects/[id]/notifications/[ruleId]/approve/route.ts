/**
 * POST /api/events/projects/[id]/notifications/[ruleId]/approve
 *
 * Submit, approve, or cancel a notification rule.
 * Body: { action: 'submit' | 'approve' | 'cancel' }
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  submitForApproval,
  approveRule,
  cancelRule,
} from '@/lib/services/notificationOrchestrationService'

const ApproveActionSchema = z.object({
  action: z.enum(['submit', 'approve', 'cancel']),
})

export const POST = withAuth(async ({ params, ctx, body }) => {
  const { ruleId } = params
  const { action } = body

  try {
    let updated

    if (action === 'submit') {
      updated = await submitForApproval(ruleId)
    } else if (action === 'approve') {
      updated = await approveRule(ruleId, ctx.userId)
    } else {
      updated = await cancelRule(ruleId)
    }

    return NextResponse.json(ok(updated))
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('Cannot submit') ||
        error.message.includes('Cannot approve') ||
        error.message.includes('Cannot cancel') ||
        error.message.includes('in the past'))
    ) {
      return NextResponse.json(fail('CONFLICT', error.message), { status: 409 })
    }
    throw error
  }
}, { permission: PERMISSIONS.EVENTS_NOTIFICATIONS_MANAGE, schema: ApproveActionSchema })
