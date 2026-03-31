import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getPlayerStatLeaders } from '@/lib/services/athleticsService'

export const GET = withAuth(async ({ searchParams }) => {
  const statKey = searchParams.get('statKey')
  if (!statKey) {
    return NextResponse.json(fail('VALIDATION_ERROR', 'statKey is required'), { status: 400 })
  }

  const sportId = searchParams.get('sportId') || undefined
  const seasonId = searchParams.get('seasonId') || undefined
  const limit = searchParams.get('limit')

  const leaders = await getPlayerStatLeaders({
    statKey,
    sportId,
    seasonId,
    limit: limit ? parseInt(limit, 10) : undefined,
  })
  return NextResponse.json(ok(leaders))
}, { permission: PERMISSIONS.ATHLETICS_READ })
