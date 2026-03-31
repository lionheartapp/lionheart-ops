/**
 * GET  /api/it/summer/mode — get summer mode status
 * POST /api/it/summer/mode — toggle summer mode on/off
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getSummerModeStatus,
  activateSummerMode,
  deactivateSummerMode,
} from '@/lib/services/itSummerService'

export const GET = withAuth(async () => {
  const status = await getSummerModeStatus()

  return NextResponse.json(ok(status))
}, { permission: PERMISSIONS.IT_SUMMER_MANAGE })

export const POST = withAuth(async ({ req }) => {
  const body = await req.json()
  const { active, startDate, endDate } = body as {
    active: boolean
    startDate?: string
    endDate?: string
  }

  if (typeof active !== 'boolean') {
    return NextResponse.json(fail('VALIDATION_ERROR', 'active must be a boolean'), { status: 400 })
  }

  const result = active
    ? await activateSummerMode(startDate, endDate)
    : await deactivateSummerMode()

  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.IT_SUMMER_MANAGE })
