import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getSports, createSport } from '@/lib/services/athleticsService'

const CreateSportSchema = z.object({
  name: z.string().trim().min(1).max(100),
  abbreviation: z.string().trim().max(10).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  seasonType: z.enum(['FALL', 'WINTER', 'SPRING', 'YEAR_ROUND']).optional(),
})

export const GET = withAuth(async () => {
  const sports = await getSports({ isActive: true })
  return NextResponse.json(ok(sports))
}, { permission: PERMISSIONS.ATHLETICS_READ })

export const POST = withAuth(async ({ body }) => {
  const sport = await createSport(body)
  return NextResponse.json(ok(sport), { status: 201 })
}, { permission: PERMISSIONS.ATHLETICS_MANAGE, schema: CreateSportSchema })
