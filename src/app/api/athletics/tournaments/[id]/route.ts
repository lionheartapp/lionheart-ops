import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getTournamentById, updateTournament, deleteTournament } from '@/lib/services/athleticsService'

const UpdateTournamentSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  startDate: z.string().transform((s) => new Date(s)).optional(),
  endDate: z.string().transform((s) => new Date(s)).optional(),
})

export const GET = withAuth(async ({ params }) => {
  const tournament = await getTournamentById(params.id)
  if (!tournament) {
    return NextResponse.json(fail('NOT_FOUND', 'Tournament not found'), { status: 404 })
  }
  return NextResponse.json(ok(tournament))
}, { permission: PERMISSIONS.ATHLETICS_READ })

export const PUT = withAuth(async ({ params, body }) => {
  const tournament = await updateTournament(params.id, body)
  return NextResponse.json(ok(tournament))
}, { permission: PERMISSIONS.ATHLETICS_TOURNAMENTS_MANAGE, schema: UpdateTournamentSchema })

export const DELETE = withAuth(async ({ params }) => {
  await deleteTournament(params.id)
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.ATHLETICS_TOURNAMENTS_MANAGE })
