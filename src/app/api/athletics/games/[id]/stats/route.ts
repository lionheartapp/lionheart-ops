import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getPlayerGameStats, bulkUpsertPlayerGameStats } from '@/lib/services/athleticsService'

const BulkStatsSchema = z.object({
  stats: z.array(z.object({
    rosterId: z.string().min(1),
    statKey: z.string().min(1),
    statValue: z.number(),
  })),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.ATHLETICS_READ)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      const stats = await getPlayerGameStats({ gameId: id })
      return NextResponse.json(ok(stats))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch stats'), { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()
    await assertCan(ctx.userId, PERMISSIONS.ATHLETICS_STATS_MANAGE)
    const { id: gameId } = await params

    return await runWithOrgContext(orgId, async () => {
      const input = BulkStatsSchema.parse(body)
      const statsWithGameId = input.stats.map((s) => ({ ...s, gameId }))
      const results = await bulkUpsertPlayerGameStats(statsWithGameId)
      return NextResponse.json(ok(results))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to save stats'), { status: 500 })
  }
}
