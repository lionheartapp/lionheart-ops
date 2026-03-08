/**
 * POST /api/it/student-password/lookup — public student lookup for password reset
 *
 * No authentication required. Returns only masked name for security.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { rawPrisma } from '@/lib/db'
import { lookupStudent } from '@/lib/services/itStudentPasswordService'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { orgSlug, studentId, email } = body as {
      orgSlug: string
      studentId?: string
      email?: string
    }

    if (!orgSlug) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'orgSlug is required'),
        { status: 400 }
      )
    }

    if (!studentId && !email) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'studentId or email is required'),
        { status: 400 }
      )
    }

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
    console.error('[POST /api/it/student-password/lookup]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
