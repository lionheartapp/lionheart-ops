/**
 * GET /api/submission-review/audit — query audit trail
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getAuditEvents } from '@/lib/services/submissionReviewService'

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const events = await getAuditEvents(orgId, {
    submissionId: searchParams.get('submissionId') || undefined,
    studentUserId: searchParams.get('studentUserId') || undefined,
    policyId: searchParams.get('policyId') || undefined,
    eventType: searchParams.get('eventType') || undefined,
    limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined,
    offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : undefined,
  })
  return NextResponse.json(ok(events))
}, { permission: PERMISSIONS.SR_AUDIT_READ })
