import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { updateSport } from '@/lib/services/athleticsService'

const UpdateSportSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  abbreviation: z.string().trim().max(10).nullable().optional(),
  color: z.string().optional(),
  seasonType: z.enum(['FALL', 'WINTER', 'SPRING', 'YEAR_ROUND']).optional(),
})

export const PUT = withAuth(async ({ params, body }) => {
  const sport = await updateSport(params.id, body)
  return NextResponse.json(ok(sport))
}, { permission: PERMISSIONS.ATHLETICS_MANAGE, schema: UpdateSportSchema })
