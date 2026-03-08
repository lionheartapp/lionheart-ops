/**
 * POST /api/it/student-password/admin/generate — admin-generate a password reset token
 *
 * Authenticated route. IT staff can generate a reset token for any student
 * and share it directly (e.g., in person or via secure channel).
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { generateResetToken } from '@/lib/services/itStudentPasswordService'

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_STUDENT_PASSWORD)

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
    const result = await runWithOrgContext(orgId, () =>
      generateResetToken(orgId, studentId)
    )

    return NextResponse.json(ok({
      token: result.token,
      expiresAt: result.expiresAt.toISOString(),
    }), { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
    }
    console.error('[POST /api/it/student-password/admin/generate]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
