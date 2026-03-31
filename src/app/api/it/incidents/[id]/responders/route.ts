import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { addResponder, removeResponder } from '@/lib/services/securityIncidentService'

const ResponderSchema = z.object({
  responderId: z.string().min(1),
  action: z.enum(['add', 'remove']),
})

export const POST = withAuth(async ({ orgId, ctx, params, body }) => {
  const updated = body.action === 'add'
    ? await addResponder(orgId, params.id, ctx.userId, body.responderId)
    : await removeResponder(orgId, params.id, ctx.userId, body.responderId)

  return NextResponse.json(ok(updated))
}, { permission: PERMISSIONS.IT_INCIDENT_MANAGE, schema: ResponderSchema })
