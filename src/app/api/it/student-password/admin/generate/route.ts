/**
 * POST /api/it/student-password/admin/generate — admin-generate a password reset token
 *
 * Authenticated route. IT staff can generate a reset token for any student
 * and share it directly (e.g., in person or via secure channel).
 *
 * Rate limited per IP to bound abuse even for authenticated callers.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { generateResetToken } from '@/lib/services/itStudentPasswordService'
import { studentPasswordRateLimiter, getRateLimitHeaders } from '@/lib/rate-limit'
import { getIp } from '@/lib/services/auditService'

const generateSchema = z.object({
  studentId: z.string().trim().min(1, 'studentId is required').max(200),
})

export const POST = withAuth(
  async ({ orgId, req, body }) => {
    // ─── Rate limit check (per IP) ────────────────────────────────────
    const ip = getIp(req) ?? 'unknown'
    const limitResult = await studentPasswordRateLimiter.hit(ip)
    if (!limitResult.allowed) {
      return NextResponse.json(
        fail('RATE_LIMITED', 'Too many requests. Please try again later.'),
        { status: 429, headers: getRateLimitHeaders(limitResult) }
      )
    }

    // generateResetToken uses rawPrisma internally, but we still run in org context
    // for consistency and to pass the correct orgId
    const result = await generateResetToken(orgId, body.studentId)

    return NextResponse.json(
      ok({
        token: result.token,
        expiresAt: result.expiresAt.toISOString(),
      }),
      { status: 201 }
    )
  },
  { permission: PERMISSIONS.IT_STUDENT_PASSWORD, schema: generateSchema }
)
