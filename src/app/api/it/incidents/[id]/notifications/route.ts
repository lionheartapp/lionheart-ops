import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { logExternalNotification } from '@/lib/services/securityIncidentService'

const ExternalNotificationSchema = z.object({
  recipientType: z.string().min(1),
  method: z.string().min(1),
  notes: z.string().optional(),
})

export const POST = withAuth(async ({ orgId, ctx, params, body }) => {
  const updated = await logExternalNotification(orgId, params.id, ctx.userId, body)
  return NextResponse.json(ok(updated))
}, { permission: PERMISSIONS.IT_INCIDENT_MANAGE, schema: ExternalNotificationSchema })
