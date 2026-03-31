import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { attachEvidence } from '@/lib/services/securityIncidentService'

const EvidenceSchema = z.object({
  url: z.string().min(1),
  fileName: z.string().min(1),
  fileHash: z.string().min(1),
})

export const POST = withAuth(async ({ orgId, ctx, params, body }) => {
  const updated = await attachEvidence(orgId, params.id, ctx.userId, body)
  return NextResponse.json(ok(updated))
}, { permission: PERMISSIONS.IT_INCIDENT_CREATE, schema: EvidenceSchema })
