import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getRoster, createRosterPlayer } from '@/lib/services/athleticsService'

const CreateSchema = z.object({
  athleticTeamId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  jerseyNumber: z.string().optional(),
  position: z.string().optional(),
  grade: z.string().optional(),
  height: z.string().optional(),
  weight: z.string().optional(),
  userId: z.string().optional(),
})

export const GET = withAuth(async ({ searchParams }) => {
  const teamId = searchParams.get('teamId') || undefined
  const isActive = searchParams.get('isActive')

  const roster = await getRoster({
    teamId,
    isActive: isActive != null ? isActive === 'true' : undefined,
  })
  return NextResponse.json(ok(roster))
}, { permission: PERMISSIONS.ATHLETICS_READ })

export const POST = withAuth(async ({ body }) => {
  const player = await createRosterPlayer(body)
  return NextResponse.json(ok(player), { status: 201 })
}, { permission: PERMISSIONS.ATHLETICS_ROSTER_MANAGE, schema: CreateSchema })
