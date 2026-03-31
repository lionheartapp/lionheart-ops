/**
 * PATCH  /api/maintenance/tickets/[id]/costs/[entryId]  — update cost entry
 * DELETE /api/maintenance/tickets/[id]/costs/[entryId]  — delete cost entry
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { updateCostEntry, deleteCostEntry } from '@/lib/services/laborCostService'

export const PATCH = withAuth(async ({ req, orgId, params }) => {
  const body = await req.json()

  try {
    const entry = await updateCostEntry(orgId, params.entryId, body)
    return NextResponse.json(ok(entry))
  } catch (err) {
    if (err instanceof Error && err.message === 'NOT_FOUND') {
      return NextResponse.json(fail('NOT_FOUND', 'Cost entry not found'), { status: 404 })
    }
    throw err
  }
}, { permission: PERMISSIONS.MAINTENANCE_CLAIM })

export const DELETE = withAuth(async ({ orgId, params }) => {
  try {
    await deleteCostEntry(orgId, params.entryId)
  } catch (err) {
    if (err instanceof Error && err.message === 'NOT_FOUND') {
      return NextResponse.json(fail('NOT_FOUND', 'Cost entry not found'), { status: 404 })
    }
    throw err
  }

  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.MAINTENANCE_CLAIM })
