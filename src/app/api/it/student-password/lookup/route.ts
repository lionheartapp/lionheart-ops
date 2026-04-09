/**
 * POST /api/it/student-password/lookup — public student lookup for password reset
 *
 * No authentication required. Returns only masked name for security.
 * Rate limited to prevent student enumeration attacks.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { rawPrisma } from '@/lib/db'
import { lookupStudent } from '@/lib/services/itStudentPasswordService'
import { logger } from '@/lib/logger'
import { studentPasswordRateLimiter, getRateLimitHeaders } from '@/lib/rate-limit'
import { getIp } from '@/lib/services/auditService'

const lookupSchema = z
  .object({
    orgSlug: z.string().trim().min(1, 'orgSlug is required').max(200),
    studentId: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().toLowerCase().email('Invalid email address').max(320).optional(),
  })
  .refine((data) => Boolean(data.studentId) || Boolean(data.email), {
    message: 'studentId or email is required',
    path: ['studentId'],
  })

export async function POST(req: NextRequest) {
  try {
    // ─── Rate limit check (per IP, before any body parsing) ──────────
    const ip = getIp(req) ?? 'unknown'
    const limitResult = await studentPasswordRateLimiter.hit(ip)
    if (!limitResult.allowed) {
      return NextResponse.json(
        fail('RATE_LIMITED', 'Too many requests. Please try again later.'),
        { status: 429, headers: getRateLimitHeaders(limitResult) }
      )
    }

    const raw = await req.json().catch(() => null)
    const parsed = lookupSchema.safeParse(raw)

    if (!parsed.success) {
      return NextResponse.json(
        fail(
          'VALIDATION_ERROR',
          'Invalid input',
          parsed.error.issues.map((e) => e.message)
        ),
        { status: 400 }
      )
    }

    const { orgSlug, studentId, email } = parsed.data

    // Look up org by slug (public, no auth context)
    const org = await rawPrisma.organization.findFirst({
      where: { slug: orgSlug },
      select: { id: true },
    })

    if (!org) {
      // Don't reveal whether the org exists or not
      return NextResponse.json(ok({ found: false }))
    }

    const student = await lookupStudent(org.id, { studentId, email })

    if (!student) {
      return NextResponse.json(ok({ found: false }))
    }

    // Mask the student name for security (e.g., "J*** D**")
    const maskedFirst = student.firstName
      ? student.firstName[0] + '***'
      : '***'
    const maskedLast = student.lastName
      ? student.lastName[0] + '**'
      : '**'

    return NextResponse.json(ok({
      found: true,
      maskedName: `${maskedFirst} ${maskedLast}`,
    }))
  } catch (error) {
    logger.error({ error: String(error) }, 'Student password lookup failed')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
