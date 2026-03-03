import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getEventResourceRequests, createBulkResourceRequests } from '@/lib/services/resourceRequestService'

const BulkCreateSchema = z.object({
  requests: z.array(z.object({
    resourceType: z.enum(['FACILITY', 'AV_EQUIPMENT', 'VIP_ATTENDANCE', 'CUSTODIAL']),
    details: z.record(z.string(), z.unknown()).optional(),
  })),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.CALENDAR_EVENTS_READ)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      const requests = await getEventResourceRequests(id)
      return NextResponse.json(ok(requests))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch resource requests'), { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()
    await assertCan(ctx.userId, PERMISSIONS.RESOURCE_REQUESTS_CREATE)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      const { requests } = BulkCreateSchema.parse(body)
      const results = await createBulkResourceRequests(id, requests)
      return NextResponse.json(ok(results), { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to create resource requests'), { status: 500 })
  }
}
