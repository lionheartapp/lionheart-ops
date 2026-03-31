/**
 * PUT /api/it/erate/calendar/[id]/complete — mark an E-Rate task complete
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { completeERateTask } from '@/lib/services/itERateService'

export const PUT = withAuth(async ({ req, orgId, ctx, params }) => {
  const body = await req.json()
  const { documentUrls, notes } = body as { documentUrls?: string[]; notes?: string }

  const task = await completeERateTask(orgId, params.id, ctx.userId, { documentUrls, notes })

  return NextResponse.json(ok(task))
}, { permission: PERMISSIONS.IT_ERATE_MANAGE })
