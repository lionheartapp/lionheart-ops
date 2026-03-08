/**
 * GET /api/it/damage/default-fees — get default damage fee schedule
 * PUT /api/it/damage/default-fees — update default damage fee schedule
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getDefaultFees, updateDefaultFees } from '@/lib/services/itDamageService'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_DEVICE_CONFIGURE)

    const fees = await runWithOrgContext(orgId, () => getDefaultFees())

    return NextResponse.json(ok(fees))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/it/damage/default-fees]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_DEVICE_CONFIGURE)

    const body = await req.json()

    // Validate that body is an object with string keys and number values
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Body must be a JSON object of condition -> fee mappings'),
        { status: 400 }
      )
    }

    for (const [key, value] of Object.entries(body)) {
      if (typeof value !== 'number' || value < 0) {
        return NextResponse.json(
          fail('VALIDATION_ERROR', `Fee for "${key}" must be a non-negative number`),
          { status: 400 }
        )
      }
    }

    const result = await runWithOrgContext(orgId, () =>
      updateDefaultFees(body as Record<string, number>)
    )

    return NextResponse.json(ok(result))
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
      if (error.message === 'Device config not found') {
        return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
      }
    }
    console.error('[PUT /api/it/damage/default-fees]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
