import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getTeamStandings } from '@/lib/services/athleticsService'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.ATHLETICS_READ)

    const sportId = req.nextUrl.searchParams.get('sportId') || undefined
    const seasonId = req.nextUrl.searchParams.get('seasonId') || undefined

    return await runWithOrgContext(orgId, async () => {
      const standings = await getTeamStandings({ sportId, seasonId })
      return NextResponse.json(ok(standings))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch standings'), { status: 500 })
  }
}
