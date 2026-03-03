import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getResourceRequests, createResourceRequest } from '@/lib/services/resourceRequestService'

const CreateResourceRequestSchema = z.object({
  eventId: z.string().min(1),
  resourceType: z.enum(['FACILITY', 'AV_EQUIPMENT', 'VIP_ATTENDANCE', 'CUSTODIAL']),
  details: z.record(z.string(), z.unknown()).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.RESOURCE_REQUESTS_READ_ALL)

    return await runWithOrgContext(orgId, async () => {
      const { searchParams } = new URL(req.url)
      const status = searchParams.get('status') || undefined
      const resourceType = searchParams.get('resourceType') || undefined
      const requests = await getResourceRequests({ status, resourceType })
      return NextResponse.json(ok(requests))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch resource requests'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()
    await assertCan(ctx.userId, PERMISSIONS.RESOURCE_REQUESTS_CREATE)

    return await runWithOrgContext(orgId, async () => {
      const input = CreateResourceRequestSchema.parse(body)
      const request = await createResourceRequest(input)
      return NextResponse.json(ok(request), { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to create resource request'), { status: 500 })
  }
}
