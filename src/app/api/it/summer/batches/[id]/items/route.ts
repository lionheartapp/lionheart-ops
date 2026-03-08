/**
 * POST /api/it/summer/batches/[id]/items — add devices to a summer batch
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { addDevicesToSummerBatch } from '@/lib/services/itSummerService'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_SUMMER_MANAGE)

    const body = await req.json()
    const { deviceIds } = body as { deviceIds: string[] }

    if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'deviceIds must be a non-empty array'),
        { status: 400 }
      )
    }

    const result = await runWithOrgContext(orgId, () =>
      addDevicesToSummerBatch(id, deviceIds)
    )

    return NextResponse.json(ok(result), { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
    }
    console.error('[POST /api/it/summer/batches/[id]/items]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
