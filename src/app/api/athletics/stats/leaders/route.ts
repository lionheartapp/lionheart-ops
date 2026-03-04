import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getPlayerStatLeaders } from '@/lib/services/athleticsService'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.ATHLETICS_READ)

    const statKey = req.nextUrl.searchParams.get('statKey')
    if (!statKey) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'statKey is required'), { status: 400 })
    }

    const sportId = req.nextUrl.searchParams.get('sportId') || undefined
    const seasonId = req.nextUrl.searchParams.get('seasonId') || undefined
    const limit = req.nextUrl.searchParams.get('limit')

    return await runWithOrgContext(orgId, async () => {
      const leaders = await getPlayerStatLeaders({
        statKey,
        sportId,
        seasonId,
        limit: limit ? parseInt(limit, 10) : undefined,
      })
      return NextResponse.json(ok(leaders))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch stat leaders'), { status: 500 })
  }
}
