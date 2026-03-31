/**
 * PATCH  /api/maintenance/tickets/[id]/labor/[entryId]  — update labor entry
 * DELETE /api/maintenance/tickets/[id]/labor/[entryId]  — delete labor entry
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { updateLaborEntry, deleteLaborEntry } from '@/lib/services/laborCostService'

export const PATCH = withAuth(async ({ req, orgId, params }) => {
  const body = await req.json()

  try {
    const entry = await updateLaborEntry(orgId, params.entryId, body)
    return NextResponse.json(ok(entry))
  } catch (err) {
    if (err instanceof Error && err.message === 'NOT_FOUND') {
      return NextResponse.json(fail('NOT_FOUND', 'Labor entry not found'), { status: 404 })
    }
    if (err instanceof Error && err.message.startsWith('VALIDATION_ERROR')) {
      return NextResponse.json(fail('VALIDATION_ERROR', err.message), { status: 400 })
    }
    throw err
  }
}, { permission: PERMISSIONS.MAINTENANCE_CLAIM })

export const DELETE = withAuth(async ({ orgId, params }) => {
  try {
    await deleteLaborEntry(orgId, params.entryId)
  } catch (err) {
    if (err instanceof Error && err.message === 'NOT_FOUND') {
      return NextResponse.json(fail('NOT_FOUND', 'Labor entry not found'), { status: 404 })
    }
    throw err
  }

  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.MAINTENANCE_CLAIM })
