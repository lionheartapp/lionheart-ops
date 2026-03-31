import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { transitionPhase } from '@/lib/services/planningSeasonService'
import { z } from 'zod'

const PhaseSchema = z.object({
  phase: z.enum(['SETUP', 'COLLECTING', 'REVIEWING', 'WAR_ROOM', 'FINALIZING', 'APPROVING', 'CLOSED']),
})

export const PUT = withAuth(async ({ params, body }) => {
  const season = await transitionPhase(params.id, body.phase)
  return NextResponse.json(ok(season))
}, { permission: PERMISSIONS.PLANNING_MANAGE, schema: PhaseSchema })
