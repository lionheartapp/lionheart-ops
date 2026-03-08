/**
 * POST /api/it/ai/diagnose-device/[deviceId] — run AI diagnostics on a device
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { diagnoseDevice } from '@/lib/services/itAIDiagnosticService'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_AI_DIAGNOSTIC)

    const result = await runWithOrgContext(orgId, () => diagnoseDevice(deviceId))

    return NextResponse.json(ok(result))
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
      if (error.message.includes('not found')) {
        return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
      }
    }
    console.error('[POST /api/it/ai/diagnose-device/[deviceId]]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
