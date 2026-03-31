/**
 * GET /api/it/audit/students — FERPA audit log (requires students:audit)
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getStudentAuditLog } from '@/lib/services/studentAuditService'
import type { StudentAuditAction } from '@/lib/services/studentAuditService'

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const filters = {
    organizationId: orgId,
    studentId: searchParams.get('studentId') || undefined,
    userId: searchParams.get('userId') || undefined,
    action: (searchParams.get('action') || undefined) as StudentAuditAction | undefined,
    limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
    offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined,
  }

  const result = await getStudentAuditLog(filters)

  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.STUDENTS_AUDIT })
