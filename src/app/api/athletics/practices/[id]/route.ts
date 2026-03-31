import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { updatePractice, deletePractice } from '@/lib/services/athleticsService'

const UpdatePracticeSchema = z.object({
  startTime: z.string().transform((s) => new Date(s)).optional(),
  endTime: z.string().transform((s) => new Date(s)).optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  rrule: z.string().nullable().optional(),
})

export const PUT = withAuth(async ({ params, body }) => {
  const practice = await updatePractice(params.id, body)
  return NextResponse.json(ok(practice))
}, { permission: PERMISSIONS.ATHLETICS_PRACTICES_CREATE, schema: UpdatePracticeSchema })

export const DELETE = withAuth(async ({ params }) => {
  await deletePractice(params.id)
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.ATHLETICS_PRACTICES_CREATE })
