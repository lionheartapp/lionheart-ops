import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getAthlete, updateAthlete, deleteAthlete } from '@/lib/services/athleticsService'

const UpdateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  grade: z.string().nullable().optional(),
  height: z.string().nullable().optional(),
  weight: z.string().nullable().optional(),
  photoUrl: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export const GET = withAuth(async ({ params }) => {
  const athlete = await getAthlete(params.id)
  if (!athlete) {
    return NextResponse.json(fail('NOT_FOUND', 'Player not found'), { status: 404 })
  }
  return NextResponse.json(ok(athlete))
}, { permission: PERMISSIONS.ATHLETICS_READ })

export const PUT = withAuth(async ({ params, body }) => {
  const athlete = await updateAthlete(params.id, body)
  return NextResponse.json(ok(athlete))
}, { permission: PERMISSIONS.ATHLETICS_ROSTER_MANAGE, schema: UpdateSchema })

export const DELETE = withAuth(async ({ params }) => {
  await deleteAthlete(params.id)
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.ATHLETICS_ROSTER_MANAGE })
