import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getTournamentById,
  generateSingleEliminationBracket,
  generateRoundRobinBracket,
} from '@/lib/services/athleticsService'
import { prisma } from '@/lib/db'

const db = prisma as any

const GenerateBracketsSchema = z.object({
  teamIds: z.array(z.string().min(1)).min(2, 'Need at least 2 teams'),
})

export const GET = withAuth(async ({ params }) => {
  const brackets = await db.tournamentBracket.findMany({
    where: { tournamentId: params.id },
    include: {
      team1: { select: { id: true, name: true, level: true, sport: { select: { name: true, color: true } } } },
      team2: { select: { id: true, name: true, level: true, sport: { select: { name: true, color: true } } } },
      winner: { select: { id: true, name: true, level: true, sport: { select: { name: true, color: true } } } },
    },
    orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
  })
  return NextResponse.json(ok(brackets))
}, { permission: PERMISSIONS.ATHLETICS_READ })

export const POST = withAuth(async ({ params, body }) => {
  const tournament = await getTournamentById(params.id)
  if (!tournament) {
    return NextResponse.json(fail('NOT_FOUND', 'Tournament not found'), { status: 404 })
  }

  let brackets
  switch (tournament.format) {
    case 'SINGLE_ELIMINATION':
      brackets = await generateSingleEliminationBracket(params.id, body.teamIds)
      break
    case 'ROUND_ROBIN':
      brackets = await generateRoundRobinBracket(params.id, body.teamIds)
      break
    case 'DOUBLE_ELIMINATION':
    case 'POOL_PLAY':
      // For now, generate as round-robin (simple grouped matches)
      brackets = await generateRoundRobinBracket(params.id, body.teamIds)
      break
    default:
      brackets = await generateSingleEliminationBracket(params.id, body.teamIds)
  }

  return NextResponse.json(ok(brackets), { status: 201 })
}, { permission: PERMISSIONS.ATHLETICS_TOURNAMENTS_MANAGE, schema: GenerateBracketsSchema })
