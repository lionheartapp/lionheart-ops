/**
 * GET  /api/events/projects/[id]/notifications  — list notification rules
 * POST /api/events/projects/[id]/notifications  — create notification rule
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { NotificationRuleInputSchema } from '@/lib/types/notification-orchestration'
import { getRules, createRule } from '@/lib/services/notificationOrchestrationService'

export const GET = withAuth(async ({ params }) => {
  const rules = await getRules(params.id)
  return NextResponse.json(ok(rules))
}, { permission: PERMISSIONS.EVENTS_NOTIFICATIONS_MANAGE })

export const POST = withAuth(async ({ params, ctx, body }) => {
  const rule = await createRule(params.id, body, ctx.userId)
  return NextResponse.json(ok(rule), { status: 201 })
}, { permission: PERMISSIONS.EVENTS_NOTIFICATIONS_MANAGE, schema: NotificationRuleInputSchema })
