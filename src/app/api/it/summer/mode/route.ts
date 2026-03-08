/**
 * GET  /api/it/summer/mode — get summer mode status
 * POST /api/it/summer/mode — toggle summer mode on/off
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getSummerModeStatus,
  activateSummerMode,
  deactivateSummerMode,
} from '@/lib/services/itSummerService'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_SUMMER_MANAGE)

    const status = await runWithOrgContext(orgId, () => getSummerModeStatus())

    return NextResponse.json(ok(status))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/it/summer/mode]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_SUMMER_MANAGE)

    const body = await req.json()
    const { active, startDate, endDate } = body as {
      active: boolean
      startDate?: string
      endDate?: string
    }

    if (typeof active !== 'boolean') {
      return NextResponse.json(fail('VALIDATION_ERROR', 'active must be a boolean'), { status: 400 })
    }

    const result = await runWithOrgContext(orgId, async () => {
      if (active) {
        return activateSummerMode(startDate, endDate)
      } else {
        return deactivateSummerMode()
      }
    })

    return NextResponse.json(ok(result))
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
      if (error.name === 'ZodError') {
        return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid request data', [error.message]), { status: 400 })
      }
    }
    console.error('[POST /api/it/summer/mode]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
