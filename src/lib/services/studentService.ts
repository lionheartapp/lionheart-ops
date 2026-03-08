import { z } from 'zod'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import { can } from '@/lib/auth/permissions'

// ============= Validation Schemas =============

export const CreateStudentSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email().optional(),
  studentId: z.string().optional(),
  externalId: z.string().optional(),
  grade: z.string().optional(),
  gradeNumeric: z.number().int().min(0).max(12).optional(),
  schoolId: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'TRANSFERRED', 'GRADUATED']).default('ACTIVE'),
  rosterSource: z.enum(['CLEVER', 'CLASSLINK', 'MANUAL']).default('MANUAL'),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const UpdateStudentSchema = CreateStudentSchema.partial()

export type CreateStudentInput = z.infer<typeof CreateStudentSchema>
export type UpdateStudentInput = z.infer<typeof UpdateStudentSchema>

// ============= Types =============

export interface StudentListContext {
  userId: string
  orgId: string
}

export interface StudentListFilters {
  schoolId?: string
  grade?: string
  status?: 'ACTIVE' | 'INACTIVE' | 'TRANSFERRED' | 'GRADUATED'
  search?: string
  limit?: number
  offset?: number
}

// ============= Service Functions =============

/**
 * Create a new student record.
 * organizationId is auto-injected by the org-scoped Prisma extension.
 */
export async function createStudent(input: CreateStudentInput) {
  const validated = CreateStudentSchema.parse(input)

  const student = await (prisma.student.create as Function)({
    data: {
      firstName: validated.firstName,
      lastName: validated.lastName,
      email: validated.email ?? null,
      studentId: validated.studentId ?? null,
      externalId: validated.externalId ?? null,
      grade: validated.grade ?? null,
      gradeNumeric: validated.gradeNumeric ?? null,
      schoolId: validated.schoolId ?? null,
      status: validated.status,
      rosterSource: validated.rosterSource,
      metadata: validated.metadata ?? undefined,
    },
    include: {
      school: {
        select: { id: true, name: true, gradeLevel: true, color: true },
      },
    },
  })

  return student
}

/**
 * Update an existing student record.
 */
export async function updateStudent(id: string, input: UpdateStudentInput) {
  const validated = UpdateStudentSchema.parse(input)

  const updateData: Record<string, unknown> = {}
  if (validated.firstName !== undefined) updateData.firstName = validated.firstName
  if (validated.lastName !== undefined) updateData.lastName = validated.lastName
  if (validated.email !== undefined) updateData.email = validated.email ?? null
  if (validated.studentId !== undefined) updateData.studentId = validated.studentId ?? null
  if (validated.externalId !== undefined) updateData.externalId = validated.externalId ?? null
  if (validated.grade !== undefined) updateData.grade = validated.grade ?? null
  if (validated.gradeNumeric !== undefined) updateData.gradeNumeric = validated.gradeNumeric ?? null
  if (validated.schoolId !== undefined) updateData.schoolId = validated.schoolId ?? null
  if (validated.status !== undefined) updateData.status = validated.status
  if (validated.rosterSource !== undefined) updateData.rosterSource = validated.rosterSource
  if (validated.metadata !== undefined) updateData.metadata = validated.metadata ?? undefined

  const student = await (prisma.student.update as Function)({
    where: { id },
    data: updateData,
    include: {
      school: {
        select: { id: true, name: true, gradeLevel: true, color: true },
      },
    },
  })

  return student
}

/**
 * Soft-delete a student record.
 * The org-scoped Prisma extension converts .delete() to a deletedAt stamp.
 */
export async function deleteStudent(id: string) {
  await (prisma.student.delete as Function)({
    where: { id },
  })
}

/**
 * Resolve the caller's schoolId from the User record.
 * Used for FERPA own-school scoping.
 */
async function getCallerSchoolId(userId: string): Promise<string | null> {
  const user = await (prisma.user.findUnique as Function)({
    where: { id: userId },
    select: { schoolId: true },
  })
  return user?.schoolId ?? null
}

/**
 * List students with FERPA-scoped access control, filtering, and pagination.
 *
 * Access rules:
 *  - students:read        → full access to all students
 *  - students:read:own-school → only students in the caller's school
 *  - neither              → empty result set
 */
export async function listStudents(
  filters: StudentListFilters,
  context: StudentListContext
) {
  const { userId } = context
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100)
  const offset = Math.max(filters.offset ?? 0, 0)

  // --- FERPA access check ---
  const canReadAll = await can(userId, PERMISSIONS.STUDENTS_READ)
  const canReadOwnSchool = await can(userId, PERMISSIONS.STUDENTS_READ_OWN_SCHOOL)

  if (!canReadAll && !canReadOwnSchool) {
    return { students: [], total: 0 }
  }

  // --- Build where clause ---
  const where: Record<string, unknown> = {}

  // School scoping
  if (!canReadAll && canReadOwnSchool) {
    const callerSchoolId = await getCallerSchoolId(userId)
    if (!callerSchoolId) {
      // User has own-school permission but no school assigned — return empty
      return { students: [], total: 0 }
    }
    where.schoolId = callerSchoolId
  }

  // Explicit filters (applied on top of FERPA scoping)
  if (filters.schoolId) {
    // If user only has own-school access, ensure they can't override the scope
    if (!canReadAll && canReadOwnSchool) {
      const callerSchoolId = await getCallerSchoolId(userId)
      if (filters.schoolId !== callerSchoolId) {
        return { students: [], total: 0 }
      }
    }
    where.schoolId = filters.schoolId
  }

  if (filters.grade) {
    where.grade = filters.grade
  }

  if (filters.status) {
    where.status = filters.status
  }

  if (filters.search) {
    const search = filters.search.trim()
    if (search.length > 0) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { studentId: { contains: search, mode: 'insensitive' } },
      ]
    }
  }

  // --- Query ---
  const [students, total] = await Promise.all([
    (prisma.student.findMany as Function)({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: limit,
      skip: offset,
      include: {
        school: {
          select: { id: true, name: true, gradeLevel: true, color: true },
        },
        _count: {
          select: {
            deviceAssignments: {
              where: { returnedAt: null },
            },
          },
        },
      },
    }),
    (prisma.student.count as Function)({ where }),
  ])

  return { students, total }
}

/**
 * Get full student detail including device assignment history.
 * FERPA-scoped: same rules as listStudents.
 */
export async function getStudentDetail(
  id: string,
  context: StudentListContext
) {
  const { userId } = context

  // --- FERPA access check ---
  const canReadAll = await can(userId, PERMISSIONS.STUDENTS_READ)
  const canReadOwnSchool = await can(userId, PERMISSIONS.STUDENTS_READ_OWN_SCHOOL)

  if (!canReadAll && !canReadOwnSchool) {
    return null
  }

  const student = await (prisma.student.findUnique as Function)({
    where: { id },
    include: {
      school: {
        select: { id: true, name: true, gradeLevel: true, color: true },
      },
      deviceAssignments: {
        include: {
          device: {
            select: {
              id: true,
              assetTag: true,
              serialNumber: true,
              deviceType: true,
              make: true,
              model: true,
              status: true,
            },
          },
        },
        orderBy: { assignedAt: 'desc' },
      },
    },
  })

  if (!student) return null

  // If user only has own-school access, verify the student belongs to their school
  if (!canReadAll && canReadOwnSchool) {
    const callerSchoolId = await getCallerSchoolId(userId)
    if (!callerSchoolId || student.schoolId !== callerSchoolId) {
      return null
    }
  }

  // Separate active vs. historical assignments for convenience
  const activeAssignments = student.deviceAssignments.filter(
    (a: { returnedAt: Date | null }) => a.returnedAt === null
  )
  const allAssignments = student.deviceAssignments

  return {
    ...student,
    activeAssignments,
    allAssignments,
  }
}

/**
 * Quick search for students by name or studentId.
 * Returns top 20 results. FERPA-scoped same as listStudents.
 */
export async function searchStudents(
  query: string,
  context: StudentListContext
) {
  const { userId } = context
  const search = query.trim()
  if (search.length === 0) return []

  // --- FERPA access check ---
  const canReadAll = await can(userId, PERMISSIONS.STUDENTS_READ)
  const canReadOwnSchool = await can(userId, PERMISSIONS.STUDENTS_READ_OWN_SCHOOL)

  if (!canReadAll && !canReadOwnSchool) {
    return []
  }

  const where: Record<string, unknown> = {
    status: 'ACTIVE',
    OR: [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { studentId: { contains: search, mode: 'insensitive' } },
    ],
  }

  // Own-school scoping
  if (!canReadAll && canReadOwnSchool) {
    const callerSchoolId = await getCallerSchoolId(userId)
    if (!callerSchoolId) return []
    where.schoolId = callerSchoolId
  }

  const students = await (prisma.student.findMany as Function)({
    where,
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    take: 20,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      studentId: true,
      grade: true,
      status: true,
      school: {
        select: { id: true, name: true },
      },
    },
  })

  return students
}
