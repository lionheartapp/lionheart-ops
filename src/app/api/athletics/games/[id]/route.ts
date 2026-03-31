import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { updateGame, deleteGame } from '@/lib/services/athleticsService'

const UpdateGameSchema = z.object({
  opponentName: z.string().trim().min(1).max(200).optional(),
  homeAway: z.enum(['HOME', 'AWAY', 'NEUTRAL']).optional(),
  startTime: z.string().transform((s) => new Date(s)).optional(),
  endTime: z.string().transform((s) => new Date(s)).optional(),
  venue: z.string().optional(),
})

export const PUT = withAuth(async ({ params, body }) => {
  const game = await updateGame(params.id, body)
  return NextResponse.json(ok(game))
}, { permission: PERMISSIONS.ATHLETICS_GAMES_CREATE, schema: UpdateGameSchema })

export const DELETE = withAuth(async ({ params }) => {
  await deleteGame(params.id)
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.ATHLETICS_GAMES_CREATE })
