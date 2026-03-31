import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getResourceRequests, createResourceRequest } from '@/lib/services/resourceRequestService'

const CreateResourceRequestSchema = z.object({
  eventId: z.string().min(1),
  resourceType: z.enum(['FACILITY', 'AV_EQUIPMENT', 'VIP_ATTENDANCE', 'CUSTODIAL']),
  details: z.record(z.string(), z.unknown()).optional(),
})

export const GET = withAuth(async ({ searchParams }) => {
  const status = searchParams.get('status') || undefined
  const resourceType = searchParams.get('resourceType') || undefined
  const requests = await getResourceRequests({ status, resourceType })
  return NextResponse.json(ok(requests))
}, { permission: PERMISSIONS.RESOURCE_REQUESTS_READ_ALL })

export const POST = withAuth(async ({ body }) => {
  const request = await createResourceRequest(body)
  return NextResponse.json(ok(request), { status: 201 })
}, { permission: PERMISSIONS.RESOURCE_REQUESTS_CREATE, schema: CreateResourceRequestSchema })
