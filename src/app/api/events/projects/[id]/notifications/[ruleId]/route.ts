/**
 * PATCH  /api/events/projects/[id]/notifications/[ruleId]  — update notification rule
 * DELETE /api/events/projects/[id]/notifications/[ruleId]  — delete notification rule
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { NotificationRuleInputSchema } from '@/lib/types/notification-orchestration'
import { updateRule, deleteRule } from '@/lib/services/notificationOrchestrationService'

export const PATCH = withAuth(async ({ req, params }) => {
  const { ruleId } = params

  const body = await req.json()
  const parsed = NotificationRuleInputSchema.partial().safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
      { status: 400 }
    )
  }

  try {
    const updated = await updateRule(ruleId, parsed.data)
    return NextResponse.json(ok(updated))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Cannot update rule')) {
      return NextResponse.json(fail('CONFLICT', error.message), { status: 409 })
    }
    throw error
  }
}, { permission: PERMISSIONS.EVENTS_NOTIFICATIONS_MANAGE })

export const DELETE = withAuth(async ({ params }) => {
  const { ruleId } = params

  try {
    await deleteRule(ruleId)
    return NextResponse.json(ok(null))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Cannot delete rule')) {
      return NextResponse.json(fail('CONFLICT', error.message), { status: 409 })
    }
    throw error
  }
}, { permission: PERMISSIONS.EVENTS_NOTIFICATIONS_MANAGE })
