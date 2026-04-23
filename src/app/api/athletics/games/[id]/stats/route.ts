import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getPlayerGameStats, bulkUpsertPlayerGameStats } from '@/lib/services/athleticsService'

const BulkStatsSchema = z.object({
  stats: z.array(z.object({
    athleteId: z.string().min(1),
    rosterId: z.string().min(1),
    statKey: z.string().min(1),
    statValue: z.number(),
  })),
})

export const GET = withAuth(async ({ params }) => {
  const stats = await getPlayerGameStats({ gameId: params.id })
  return NextResponse.json(ok(stats))
}, { permission: PERMISSIONS.ATHLETICS_READ })

export const PUT = withAuth(async ({ params, body }) => {
  const statsWithGameId = body.stats.map((s) => ({ ...s, gameId: params.id }))
  const results = await bulkUpsertPlayerGameStats(statsWithGameId)
  return NextResponse.json(ok(results))
}, { permission: PERMISSIONS.ATHLETICS_STATS_MANAGE, schema: BulkStatsSchema })
