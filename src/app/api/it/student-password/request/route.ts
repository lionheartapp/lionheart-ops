/**
 * POST /api/it/student-password/request — request a password reset token
 *
 * No authentication required. Verifies student exists and email matches,
 * then generates a reset token.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { rawPrisma } from '@/lib/db'
import {
  lookupStudent,
  generateResetToken,
} from '@/lib/services/itStudentPasswordService'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { orgSlug, studentId, email } = body as {
      orgSlug: string
      studentId: string
      email: string
    }

    if (!orgSlug || !studentId || !email) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'orgSlug, studentId, and email are required'),
        { status: 400 }
      )
    }

    // Look up org by slug
    const org = await rawPrisma.organization.findFirst({
      where: { slug: orgSlug },
      select: { id: true },
    })

    if (!org) {
      // Generic error to avoid leaking org existence
      return NextResponse.json(
        fail('NOT_FOUND', 'Unable to process request'),
        { status: 404 }
      )
    }

    // Verify student exists and email matches
    const student = await lookupStudent(org.id, { studentId })

    if (!student || student.email?.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        fail('NOT_FOUND', 'Student not found or email does not match'),
        { status: 404 }
      )
    }

    // Generate reset token
    const { token, expiresAt } = await generateResetToken(org.id, student.id)

    // Return the token for the frontend to use in the next step
    // (In production, this would be sent via email instead)
    return NextResponse.json(ok({
      success: true,
      token,
      expiresAt: expiresAt.toISOString(),
    }))
  } catch (error) {
    console.error('[POST /api/it/student-password/request]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
