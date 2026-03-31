import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getTeamStandings } from '@/lib/services/athleticsService'

export const GET = withAuth(async ({ searchParams }) => {
  const sportId = searchParams.get('sportId') || undefined
  const seasonId = searchParams.get('seasonId') || undefined

  const standings = await getTeamStandings({ sportId, seasonId })
  return NextResponse.json(ok(standings))
}, { permission: PERMISSIONS.ATHLETICS_READ })
