import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { submitSubmission } from '@/lib/services/planningSeasonService'

export const POST = withAuth(async ({ params }) => {
  const submission = await submitSubmission(params.subId)
  return NextResponse.json(ok(submission))
}, { permission: PERMISSIONS.PLANNING_SUBMIT })
