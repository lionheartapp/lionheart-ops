/**
 * GET   /api/it/summer/repair-queue/[repairId]/vendor-log — get vendor repair log
 * POST  /api/it/summer/repair-queue/[repairId]/vendor-log — create vendor repair log
 * PATCH /api/it/summer/repair-queue/[repairId]/vendor-log — update vendor repair log
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import {
  createVendorRepairLog,
  updateVendorRepairLog,
} from '@/lib/services/itSummerService'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ repairId: string }> }
) {
  try {
    const { repairId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_REPAIR_QUEUE_MANAGE)

    const log = await runWithOrgContext(orgId, () =>
      prisma.iTVendorRepairLog.findFirst({
        where: { repairId },
      })
    )

    return NextResponse.json(ok(log))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/it/summer/repair-queue/[repairId]/vendor-log]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ repairId: string }> }
) {
  try {
    const { repairId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_REPAIR_QUEUE_MANAGE)

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

    const log = await runWithOrgContext(orgId, () =>
      createVendorRepairLog(repairId, {
        vendorName,
        sentDate,
        estimatedCost,
        notes,
      })
    )

    return NextResponse.json(ok(log), { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
    }
    console.error('[POST /api/it/summer/repair-queue/[repairId]/vendor-log]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ repairId: string }> }
) {
  try {
    const { repairId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_REPAIR_QUEUE_MANAGE)

    const body = await req.json()

    // Find the existing vendor log for this repair
    const existingLog = await runWithOrgContext(orgId, () =>
      prisma.iTVendorRepairLog.findFirst({
        where: { repairId },
      })
    )

    if (!existingLog) {
      return NextResponse.json(
        fail('NOT_FOUND', 'No vendor log found for this repair'),
        { status: 404 }
      )
    }

    const log = await runWithOrgContext(orgId, () =>
      updateVendorRepairLog(existingLog.id, body)
    )

    return NextResponse.json(ok(log))
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
    }
    console.error('[PATCH /api/it/summer/repair-queue/[repairId]/vendor-log]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
