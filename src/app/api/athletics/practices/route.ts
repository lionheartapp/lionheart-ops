import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getPractices, createPractice } from '@/lib/services/athleticsService'

const CreatePracticeSchema = z.object({
  athleticTeamId: z.string().min(1),
  startTime: z.string().transform((s) => new Date(s)),
  endTime: z.string().transform((s) => new Date(s)),
  location: z.string().optional(),
  notes: z.string().optional(),
  rrule: z.string().optional(),
})

export const GET = withAuth(async ({ searchParams }) => {
  const practices = await getPractices({ teamId: searchParams.get('teamId') || undefined })
  return NextResponse.json(ok(practices))
}, { permission: PERMISSIONS.ATHLETICS_READ })

export const POST = withAuth(async ({ body }) => {
  const practice = await createPractice(body)
  return NextResponse.json(ok(practice), { status: 201 })
}, { permission: PERMISSIONS.ATHLETICS_PRACTICES_CREATE, schema: CreatePracticeSchema })
