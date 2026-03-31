import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getRosterPlayer, updateRosterPlayer, deleteRosterPlayer } from '@/lib/services/athleticsService'

const UpdateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  jerseyNumber: z.string().nullable().optional(),
  position: z.string().nullable().optional(),
  grade: z.string().nullable().optional(),
  height: z.string().nullable().optional(),
  weight: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export const GET = withAuth(async ({ params }) => {
  const player = await getRosterPlayer(params.id)
  if (!player) {
    return NextResponse.json(fail('NOT_FOUND', 'Player not found'), { status: 404 })
  }
  return NextResponse.json(ok(player))
}, { permission: PERMISSIONS.ATHLETICS_READ })

export const PUT = withAuth(async ({ params, body }) => {
  const player = await updateRosterPlayer(params.id, body)
  return NextResponse.json(ok(player))
}, { permission: PERMISSIONS.ATHLETICS_ROSTER_MANAGE, schema: UpdateSchema })

export const DELETE = withAuth(async ({ params }) => {
  await deleteRosterPlayer(params.id)
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.ATHLETICS_ROSTER_MANAGE })
