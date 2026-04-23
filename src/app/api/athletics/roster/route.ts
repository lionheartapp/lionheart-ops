import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getAthletes, createAthlete, addAthleteToTeam } from '@/lib/services/athleticsService'

const CreateSchema = z.object({
  athleticTeamId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  jerseyNumber: z.string().nullable().optional(),
  position: z.string().nullable().optional(),
  grade: z.string().nullable().optional(),
  height: z.string().nullable().optional(),
  weight: z.string().nullable().optional(),
  photoUrl: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
})

export const GET = withAuth(async ({ searchParams }) => {
  const isActive = searchParams.get('isActive')

  const athletes = await getAthletes({
    isActive: isActive != null ? isActive === 'true' : undefined,
  })
  return NextResponse.json(ok(athletes))
}, { permission: PERMISSIONS.ATHLETICS_READ })

export const POST = withAuth(async ({ body }) => {
  try {
    // Create the athlete record
    const athlete = await createAthlete({
      firstName: body.firstName,
      lastName: body.lastName,
      grade: body.grade || undefined,
      height: body.height || undefined,
      weight: body.weight || undefined,
      photoUrl: body.photoUrl || undefined,
      bio: body.bio || undefined,
      userId: body.userId || undefined,
    })

    // Add to team
    await addAthleteToTeam({
      athleteId: athlete.id,
      athleticTeamId: body.athleticTeamId,
      jerseyNumber: body.jerseyNumber || undefined,
      position: body.position || undefined,
    })

    // Re-fetch with full includes
    const { getAthlete } = await import('@/lib/services/athleticsService')
    const full = await getAthlete(athlete.id)
    return NextResponse.json(ok(full), { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if (msg.includes('Unique constraint')) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'A player with that jersey number already exists on this team'),
        { status: 409 }
      )
    }
    throw err
  }
}, { permission: PERMISSIONS.ATHLETICS_ROSTER_MANAGE, schema: CreateSchema })
