/**
 * POST /api/it/student-password/admin/generate — admin-generate a password reset token
 *
 * Authenticated route. IT staff can generate a reset token for any student
 * and share it directly (e.g., in person or via secure channel).
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { generateResetToken } from '@/lib/services/itStudentPasswordService'

export const POST = withAuth(async ({ orgId, req }) => {
  const body = await req.json()
  const { studentId } = body as { studentId: string }

  if (!studentId) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'studentId is required'),
      { status: 400 }
    )
  }

  // generateResetToken uses rawPrisma internally, but we still run in org context
  // for consistency and to pass the correct orgId
  const result = await generateResetToken(orgId, studentId)

  return NextResponse.json(ok({
    token: result.token,
    expiresAt: result.expiresAt.toISOString(),
  }), { status: 201 })
}, { permission: PERMISSIONS.IT_STUDENT_PASSWORD })
