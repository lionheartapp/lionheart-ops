import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getResourceRequestById, respondToResourceRequest } from '@/lib/services/resourceRequestService'

const RespondSchema = z.object({
  requestStatus: z.enum(['APPROVED', 'DECLINED', 'FULFILLED', 'CANCELLED']),
  responseNote: z.string().optional(),
})

export const GET = withAuth(async ({ params }) => {
  const request = await getResourceRequestById(params.id)
  if (!request) return NextResponse.json(fail('NOT_FOUND', 'Resource request not found'), { status: 404 })
  return NextResponse.json(ok(request))
}, { permission: PERMISSIONS.RESOURCE_REQUESTS_READ_ALL })

export const PUT = withAuth(async ({ ctx, params, body }) => {
  const request = await respondToResourceRequest(params.id, {
    ...body,
    respondedById: ctx.userId,
  })
  return NextResponse.json(ok(request))
}, { permission: PERMISSIONS.RESOURCE_REQUESTS_RESPOND, schema: RespondSchema })
