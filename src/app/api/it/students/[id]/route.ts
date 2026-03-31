/**
 * GET /api/it/students/[id] — student detail (FERPA-scoped)
 * PATCH /api/it/students/[id] — update student
 * DELETE /api/it/students/[id] — soft-delete student
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getStudentDetail,
  updateStudent,
  deleteStudent,
  UpdateStudentSchema,
} from '@/lib/services/studentService'
import { logStudentAccess } from '@/lib/services/studentAuditService'

export const GET = withAuth(async ({ orgId, ctx, params, permissions }) => {
  const student = await getStudentDetail(params.id, { userId: ctx.userId, orgId })

  if (!student) {
    throw new Error('Student not found')
  }

  // FERPA: strip sensitive fields for own-school-only callers
  const hasFullRead = await permissions.can(PERMISSIONS.STUDENTS_READ)
  const result = hasFullRead ? student : {
    ...student,
    email: undefined,
    externalId: undefined,
  }

  // Audit log
  logStudentAccess(orgId, ctx.userId, 'student.view', params.id)

  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.STUDENTS_READ_OWN_SCHOOL })

export const PATCH = withAuth(async ({ req, orgId, ctx, params }) => {
  const body = await req.json()
  const validated = UpdateStudentSchema.parse(body)

  const student = await updateStudent(params.id, validated)

  logStudentAccess(orgId, ctx.userId, 'student.update', params.id, { fields: Object.keys(validated) })

  return NextResponse.json(ok(student))
}, { permission: PERMISSIONS.STUDENTS_MANAGE })

export const DELETE = withAuth(async ({ orgId, ctx, params }) => {
  await deleteStudent(params.id)

  logStudentAccess(orgId, ctx.userId, 'student.deactivate', params.id)

  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.STUDENTS_MANAGE })
