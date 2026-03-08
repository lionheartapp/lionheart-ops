/**
 * GET /api/it/students — list students (FERPA-scoped)
 * POST /api/it/students — create a student manually
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import {
  createStudent,
  listStudents,
  CreateStudentSchema,
} from '@/lib/services/studentService'
import { logStudentAccess } from '@/lib/services/studentAuditService'
import type { StudentStatus } from '@prisma/client'

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.STUDENTS_MANAGE)

    const body = await req.json()
    const validated = CreateStudentSchema.parse(body)

    const student = await runWithOrgContext(orgId, () =>
      createStudent(validated)
    )

    // Audit log
    logStudentAccess(orgId, ctx.userId, 'student.create', student.id)

    return NextResponse.json(ok(student), { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
      if (error.name === 'ZodError') {
        return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid request data', [error.message]), { status: 400 })
      }
    }
    console.error('[POST /api/it/students]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    // At minimum, need own-school read
    await assertCan(ctx.userId, PERMISSIONS.STUDENTS_READ_OWN_SCHOOL)

    const url = new URL(req.url)
    const filters = {
      schoolId: url.searchParams.get('schoolId') || undefined,
      grade: url.searchParams.get('grade') || undefined,
      status: (url.searchParams.get('status') || undefined) as StudentStatus | undefined,
      search: url.searchParams.get('search') || undefined,
      limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined,
      offset: url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : undefined,
    }

    const result = await runWithOrgContext(orgId, () =>
      listStudents(filters, { userId: ctx.userId, orgId })
    )

    // Audit log for viewing
    logStudentAccess(orgId, ctx.userId, 'student.view', undefined, { filters })

    return NextResponse.json(ok(result))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/it/students]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
