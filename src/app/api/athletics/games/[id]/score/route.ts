import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { updateGameScore } from '@/lib/services/athleticsService'

const ScoreSchema = z.object({
  homeScore: z.number().int().min(0),
  awayScore: z.number().int().min(0),
  isFinal: z.boolean().optional(),
})

export const PUT = withAuth(async ({ params, body }) => {
  const game = await updateGameScore(params.id, body)
  return NextResponse.json(ok(game))
}, { permission: PERMISSIONS.ATHLETICS_GAMES_SCORE, schema: ScoreSchema })
