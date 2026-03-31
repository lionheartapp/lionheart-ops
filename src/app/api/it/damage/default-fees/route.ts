/**
 * GET /api/it/damage/default-fees — get default damage fee schedule
 * PUT /api/it/damage/default-fees — update default damage fee schedule
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getDefaultFees, updateDefaultFees } from '@/lib/services/itDamageService'

export const GET = withAuth(async () => {
  const fees = await getDefaultFees()

  return NextResponse.json(ok(fees))
}, { permission: PERMISSIONS.IT_DEVICE_CONFIGURE })

export const PUT = withAuth(async ({ req }) => {
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

  const result = await updateDefaultFees(body as Record<string, number>)

  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.IT_DEVICE_CONFIGURE })
