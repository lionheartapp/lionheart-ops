/**
 * GET /api/it/devices — list IT devices (filterable)
 * POST /api/it/devices — create a new IT device
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import {
  createDevice,
  listDevices,
  CreateDeviceSchema,
} from '@/lib/services/itDeviceService'
import type { ITDeviceType, ITDeviceStatus } from '@prisma/client'

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_DEVICE_CREATE)

    const body = await req.json()
    const validated = CreateDeviceSchema.parse(body)

    const device = await runWithOrgContext(orgId, () =>
      createDevice(validated, orgId)
    )

    return NextResponse.json(ok(device), { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
      if (error.name === 'ZodError') {
        return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid request data', [error.message]), { status: 400 })
      }
    }
    console.error('[POST /api/it/devices]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_DEVICE_READ)

    const url = new URL(req.url)
    const filters = {
      deviceType: (url.searchParams.get('deviceType') || undefined) as ITDeviceType | undefined,
      status: (url.searchParams.get('status') || undefined) as ITDeviceStatus | undefined,
      schoolId: url.searchParams.get('schoolId') || undefined,
      search: url.searchParams.get('search') || undefined,
      isLemon: url.searchParams.get('isLemon') === 'true' ? true : undefined,
      limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined,
      offset: url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : undefined,
    }

    const result = await runWithOrgContext(orgId, () =>
      listDevices(filters, { userId: ctx.userId, orgId })
    )

    return NextResponse.json(ok(result))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/it/devices]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
