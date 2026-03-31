/**
 * GET  /api/maintenance/tickets/[id]/labor  — list labor entries
 * POST /api/maintenance/tickets/[id]/labor  — create labor entry
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getLaborEntries, createLaborEntry } from '@/lib/services/laborCostService'

export const GET = withAuth(async ({ params }) => {
  const entries = await getLaborEntries(params.id)
  return NextResponse.json(ok(entries))
}, { permission: PERMISSIONS.MAINTENANCE_CLAIM })

export const POST = withAuth(async ({ req, orgId, ctx, params }) => {
  const body = await req.json()

  // Default technicianId to current user if not specified
  const bodyWithDefault = !body.technicianId
    ? { ...body, technicianId: ctx.userId }
    : body

  try {
    const entry = await createLaborEntry(orgId, params.id, bodyWithDefault)
    return NextResponse.json(ok(entry), { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('VALIDATION_ERROR')) {
      return NextResponse.json(fail('VALIDATION_ERROR', err.message), { status: 400 })
    }
    if (err instanceof Error && err.message.includes('ZodError')) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input'), { status: 400 })
    }
    throw err
  }
}, { permission: PERMISSIONS.MAINTENANCE_CLAIM })
