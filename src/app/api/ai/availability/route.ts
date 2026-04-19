/**
 * GET /api/ai/availability — Check if AI features are available for the current org
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { checkAiAvailability } from '@/lib/services/ai/ai-availability'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    await getUserContext(req) // just verify auth

    const availability = await checkAiAvailability(orgId)
    return NextResponse.json(ok(availability))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
