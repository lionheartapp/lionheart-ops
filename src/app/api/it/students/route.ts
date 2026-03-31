/**
 * GET /api/it/students — list students (FERPA-scoped)
 * POST /api/it/students — create a student manually
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  createStudent,
  listStudents,
  CreateStudentSchema,
} from '@/lib/services/studentService'
import { logStudentAccess } from '@/lib/services/studentAuditService'
import type { StudentStatus } from '@prisma/client'

export const POST = withAuth(async ({ req, orgId, ctx }) => {
  const body = await req.json()
  const validated = CreateStudentSchema.parse(body)

  const student = await createStudent(validated)

  // Audit log
  logStudentAccess(orgId, ctx.userId, 'student.create', student.id)

  return NextResponse.json(ok(student), { status: 201 })
}, { permission: PERMISSIONS.STUDENTS_MANAGE })

export const GET = withAuth(async ({ orgId, ctx, searchParams }) => {
  const filters = {
    schoolId: searchParams.get('schoolId') || undefined,
    grade: searchParams.get('grade') || undefined,
    status: (searchParams.get('status') || undefined) as StudentStatus | undefined,
    search: searchParams.get('search') || undefined,
    limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
    offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined,
  }

  const result = await listStudents(filters, { userId: ctx.userId, orgId })

  // Audit log for viewing
  logStudentAccess(orgId, ctx.userId, 'student.view', undefined, { filters })

  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.STUDENTS_READ_OWN_SCHOOL })
