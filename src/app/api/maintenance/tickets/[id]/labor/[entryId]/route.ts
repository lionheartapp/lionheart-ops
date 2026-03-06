/**
 * PATCH  /api/maintenance/tickets/[id]/labor/[entryId]  — update labor entry
 * DELETE /api/maintenance/tickets/[id]/labor/[entryId]  — delete labor entry
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { updateLaborEntry, deleteLaborEntry } from '@/lib/services/laborCostService'

type Params = { params: Promise<{ id: string; entryId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { entryId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.MAINTENANCE_CLAIM)

    const body = await req.json()
    let entry
    try {
      entry = await runWithOrgContext(orgId, () =>
        updateLaborEntry(orgId, entryId, body)
      )
    } catch (err) {
      if (err instanceof Error && err.message === 'NOT_FOUND') {
        return NextResponse.json(fail('NOT_FOUND', 'Labor entry not found'), { status: 404 })
      }
      if (err instanceof Error && err.message.startsWith('VALIDATION_ERROR')) {
        return NextResponse.json(fail('VALIDATION_ERROR', err.message), { status: 400 })
      }
      throw err
    }

    return NextResponse.json(ok(entry))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[PATCH /api/maintenance/tickets/[id]/labor/[entryId]]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { entryId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.MAINTENANCE_CLAIM)

    try {
      await runWithOrgContext(orgId, () => deleteLaborEntry(orgId, entryId))
    } catch (err) {
      if (err instanceof Error && err.message === 'NOT_FOUND') {
        return NextResponse.json(fail('NOT_FOUND', 'Labor entry not found'), { status: 404 })
      }
      throw err
    }

    return NextResponse.json(ok({ deleted: true }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[DELETE /api/maintenance/tickets/[id]/labor/[entryId]]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
