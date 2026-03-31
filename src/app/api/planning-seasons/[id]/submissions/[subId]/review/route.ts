import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { reviewSubmission } from '@/lib/services/planningSeasonService'
import { z } from 'zod'

const ReviewSchema = z.object({
  status: z.enum(['APPROVED_IN_PRINCIPLE', 'NEEDS_REVISION', 'DECLINED', 'APPROVED']),
  adminNotes: z.string().optional(),
})

export const POST = withAuth(async ({ params, body }) => {
  const submission = await reviewSubmission(params.subId, body)
  return NextResponse.json(ok(submission))
}, { permission: PERMISSIONS.PLANNING_REVIEW, schema: ReviewSchema })
