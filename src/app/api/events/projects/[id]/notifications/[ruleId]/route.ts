/**
 * PATCH  /api/events/projects/[id]/notifications/[ruleId]  — update notification rule
 * DELETE /api/events/projects/[id]/notifications/[ruleId]  — delete notification rule
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { ok, fail } from '@/lib/api-response'
import { NotificationRuleInputSchema } from '@/lib/types/notification-orchestration'
import { updateRule, deleteRule } from '@/lib/services/notificationOrchestrationService'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; ruleId: string } }
) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_NOTIFICATIONS_MANAGE)

    const body = await req.json()
    const parsed = NotificationRuleInputSchema.partial().safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
        { status: 400 }
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const updated = await updateRule(params.ruleId, parsed.data)
      return NextResponse.json(ok(updated))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
    }
    if (error instanceof Error && error.message.includes('Cannot update rule')) {
      return NextResponse.json(fail('CONFLICT', error.message), { status: 409 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; ruleId: string } }
) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_NOTIFICATIONS_MANAGE)

    return await runWithOrgContext(orgId, async () => {
      await deleteRule(params.ruleId)
      return NextResponse.json(ok(null))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
    }
    if (error instanceof Error && error.message.includes('Cannot delete rule')) {
      return NextResponse.json(fail('CONFLICT', error.message), { status: 409 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
