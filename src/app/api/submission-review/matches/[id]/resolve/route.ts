/**
 * POST /api/submission-review/matches/:id/resolve — resolve a verbatim match
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  resolveMatch,
  resolveMatchSchema,
} from '@/lib/services/submissionReviewService'

export const POST = withAuth(async ({ ctx, params, body }) => {
  const resolution = await resolveMatch(params.id, ctx.userId, body)
  return NextResponse.json(ok(resolution), { status: 201 })
}, { permission: PERMISSIONS.SR_REVIEW_RESOLVE, schema: resolveMatchSchema })
