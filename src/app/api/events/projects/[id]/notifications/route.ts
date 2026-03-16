/**
 * GET  /api/events/projects/[id]/notifications  — list notification rules
 * POST /api/events/projects/[id]/notifications  — create notification rule
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { ok, fail } from '@/lib/api-response'
import { NotificationRuleInputSchema } from '@/lib/types/notification-orchestration'
import { getRules, createRule } from '@/lib/services/notificationOrchestrationService'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_NOTIFICATIONS_MANAGE)

    return await runWithOrgContext(orgId, async () => {
      const rules = await getRules(params.id)
      return NextResponse.json(ok(rules))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_NOTIFICATIONS_MANAGE)

    const body = await req.json()
    const parsed = NotificationRuleInputSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
        { status: 400 }
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const rule = await createRule(params.id, parsed.data, ctx.userId)
      return NextResponse.json(ok(rule), { status: 201 })
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
