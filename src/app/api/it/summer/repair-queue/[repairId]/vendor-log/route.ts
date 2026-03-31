/**
 * GET   /api/it/summer/repair-queue/[repairId]/vendor-log — get vendor repair log
 * POST  /api/it/summer/repair-queue/[repairId]/vendor-log — create vendor repair log
 * PATCH /api/it/summer/repair-queue/[repairId]/vendor-log — update vendor repair log
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import {
  createVendorRepairLog,
  updateVendorRepairLog,
} from '@/lib/services/itSummerService'

export const GET = withAuth(async ({ params }) => {
  const log = await prisma.iTVendorRepairLog.findFirst({
    where: { repairId: params.repairId },
  })

  return NextResponse.json(ok(log))
}, { permission: PERMISSIONS.IT_REPAIR_QUEUE_MANAGE })

export const POST = withAuth(async ({ req, params }) => {
  const body = await req.json()
  const { vendorName, sentDate, estimatedCost, notes } = body as {
    vendorName: string
    sentDate?: string
    estimatedCost?: number
    notes?: string
  }

  if (!vendorName) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'vendorName is required'),
      { status: 400 }
    )
  }

  const log = await createVendorRepairLog(params.repairId, {
    vendorName,
    sentDate,
    estimatedCost,
    notes,
  })

  return NextResponse.json(ok(log), { status: 201 })
}, { permission: PERMISSIONS.IT_REPAIR_QUEUE_MANAGE })

export const PATCH = withAuth(async ({ req, params }) => {
  const body = await req.json()

  // Find the existing vendor log for this repair
  const existingLog = await prisma.iTVendorRepairLog.findFirst({
    where: { repairId: params.repairId },
  })

  if (!existingLog) {
    return NextResponse.json(
      fail('NOT_FOUND', 'No vendor log found for this repair'),
      { status: 404 }
    )
  }

  const log = await updateVendorRepairLog(existingLog.id, body)

  return NextResponse.json(ok(log))
}, { permission: PERMISSIONS.IT_REPAIR_QUEUE_MANAGE })
