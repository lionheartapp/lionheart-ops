/**
 * POST /api/it/summer/batches/[id]/items/complete — mark batch items as completed
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { bulkMarkCompleted } from '@/lib/services/itSummerService'

export const POST = withAuth(async ({ req, ctx, params }) => {
  const body = await req.json()
  const { itemIds } = body as { itemIds: string[] }

  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'itemIds must be a non-empty array'),
      { status: 400 }
    )
  }

  const result = await bulkMarkCompleted(params.id, itemIds, ctx.userId)

  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.IT_SUMMER_MANAGE })
