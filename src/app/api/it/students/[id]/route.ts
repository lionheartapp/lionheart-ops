/**
 * GET /api/it/students/[id] — student detail (FERPA-scoped)
 * PATCH /api/it/students/[id] — update student
 * DELETE /api/it/students/[id] — soft-delete student
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan, can } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getStudentDetail,
  updateStudent,
  deleteStudent,
  UpdateStudentSchema,
} from '@/lib/services/studentService'
import { logStudentAccess } from '@/lib/services/studentAuditService'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.STUDENTS_READ_OWN_SCHOOL)

    const student = await runWithOrgContext(orgId, () =>
      getStudentDetail(id, { userId: ctx.userId, orgId })
    )

    if (!student) {
      return NextResponse.json(fail('NOT_FOUND', 'Student not found'), { status: 404 })
    }

    // FERPA: strip sensitive fields for own-school-only callers
    const hasFullRead = await can(ctx.userId, PERMISSIONS.STUDENTS_READ)
    const result = hasFullRead ? student : {
      ...student,
      email: undefined,
      externalId: undefined,
    }

    // Audit log
    logStudentAccess(orgId, ctx.userId, 'student.view', id)

    return NextResponse.json(ok(result))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/it/students/[id]]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.STUDENTS_MANAGE)

    const body = await req.json()
    const validated = UpdateStudentSchema.parse(body)

    const student = await runWithOrgContext(orgId, () => updateStudent(id, validated))

    logStudentAccess(orgId, ctx.userId, 'student.update', id, { fields: Object.keys(validated) })

    return NextResponse.json(ok(student))
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
      if (error.name === 'ZodError') {
        return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid request data', [error.message]), { status: 400 })
      }
    }
    console.error('[PATCH /api/it/students/[id]]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.STUDENTS_MANAGE)

    await runWithOrgContext(orgId, () => deleteStudent(id))

    logStudentAccess(orgId, ctx.userId, 'student.deactivate', id)

    return NextResponse.json(ok({ deleted: true }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[DELETE /api/it/students/[id]]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
