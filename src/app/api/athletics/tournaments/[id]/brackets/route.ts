import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.ATHLETICS_READ)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      const brackets = await db.tournamentBracket.findMany({
        where: { tournamentId: id },
        include: {
          team1: { select: { id: true, name: true, level: true, sport: { select: { name: true, color: true } } } },
          team2: { select: { id: true, name: true, level: true, sport: { select: { name: true, color: true } } } },
          winner: { select: { id: true, name: true, level: true, sport: { select: { name: true, color: true } } } },
        },
        orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
      })
      return NextResponse.json(ok(brackets))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch brackets'), { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()
    await assertCan(ctx.userId, PERMISSIONS.ATHLETICS_TOURNAMENTS_MANAGE)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      const { teamIds } = GenerateBracketsSchema.parse(body)

      const tournament = await getTournamentById(id)
      if (!tournament) {
        return NextResponse.json(fail('NOT_FOUND', 'Tournament not found'), { status: 404 })
      }

      let brackets
      switch (tournament.format) {
        case 'SINGLE_ELIMINATION':
          brackets = await generateSingleEliminationBracket(id, teamIds)
          break
        case 'ROUND_ROBIN':
          brackets = await generateRoundRobinBracket(id, teamIds)
          break
        case 'DOUBLE_ELIMINATION':
        case 'POOL_PLAY':
          // For now, generate as round-robin (simple grouped matches)
          brackets = await generateRoundRobinBracket(id, teamIds)
          break
        default:
          brackets = await generateSingleEliminationBracket(id, teamIds)
      }

      return NextResponse.json(ok(brackets), { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('Need at least')) {
      return NextResponse.json(fail('VALIDATION_ERROR', error.message), { status: 400 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to generate brackets'), { status: 500 })
  }
}
