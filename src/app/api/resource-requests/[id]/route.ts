import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getResourceRequestById, respondToResourceRequest } from '@/lib/services/resourceRequestService'

const RespondSchema = z.object({
  requestStatus: z.enum(['APPROVED', 'DECLINED', 'FULFILLED', 'CANCELLED']),
  responseNote: z.string().optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.RESOURCE_REQUESTS_READ_ALL)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      const request = await getResourceRequestById(id)
      if (!request) return NextResponse.json(fail('NOT_FOUND', 'Resource request not found'), { status: 404 })
      return NextResponse.json(ok(request))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch resource request'), { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()
    await assertCan(ctx.userId, PERMISSIONS.RESOURCE_REQUESTS_RESPOND)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      const input = RespondSchema.parse(body)
      const request = await respondToResourceRequest(id, {
        ...input,
        respondedById: ctx.userId,
      })
      return NextResponse.json(ok(request))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to respond to resource request'), { status: 500 })
  }
}
