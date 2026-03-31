import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { bulkPublish } from '@/lib/services/planningSeasonService'
import { z } from 'zod'

const PublishSchema = z.object({
  calendarId: z.string().min(1),
})

export const POST = withAuth(async ({ params, body }) => {
  const results = await bulkPublish(params.id, body.calendarId)
  return NextResponse.json(ok(results))
}, { permission: PERMISSIONS.PLANNING_MANAGE, schema: PublishSchema })
