/**
 * Campus Service
 *
 * Handles CRUD for Campus records and UserCampusAssignment junction table.
 * Used by API routes inside runWithOrgContext — uses org-scoped `prisma`.
 */

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getOrgContextId } from '@/lib/org-context'
import { geocodeAddress } from '@/lib/services/geocodingService'

// ============= Validation Schemas =============

export const CreateCampusSchema = z.object({
  name: z.string().trim().min(1, 'Campus name is required').max(120),
  address: z.string().trim().max(400).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  campusType: z.enum(['HEADQUARTERS', 'CAMPUS', 'SATELLITE']).default('CAMPUS'),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
})

export const UpdateCampusSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  address: z.string().trim().max(400).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  campusType: z.enum(['HEADQUARTERS', 'CAMPUS', 'SATELLITE']).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

export const CreateCampusAssignmentSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  campusId: z.string().min(1, 'Campus ID is required'),
  isPrimary: z.boolean().default(false),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
})

export const UpdateCampusAssignmentSchema = z.object({
  isPrimary: z.boolean().optional(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
})

export type CreateCampusInput = z.infer<typeof CreateCampusSchema>
export type UpdateCampusInput = z.infer<typeof UpdateCampusSchema>

// ============= Campus CRUD =============

/**
 * List all campuses for the current org (auto-scoped via prisma extension).
 * Includes counts of schools and buildings per campus.
 */
export async function listCampuses() {
  return prisma.campus.findMany({
    include: {
      _count: {
        select: { schools: true, buildings: true, areas: true },
      },
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
}

/**
 * Get a single campus by ID with full related data.
 */
export async function getCampusById(campusId: string) {
  return prisma.campus.findUnique({
    where: { id: campusId },
    include: {
      _count: {
        select: { schools: true, buildings: true, areas: true, userAssignments: true },
      },
    },
  })
}

/**
 * Get the default (HQ) campus for the current org.
 * Falls back to the first active campus if no HQ exists.
 */
export async function getDefaultCampus() {
  const hq = await prisma.campus.findFirst({
    where: { campusType: 'HEADQUARTERS', isActive: true },
    select: { id: true, name: true },
  })
  if (hq) return hq

  return prisma.campus.findFirst({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true },
  })
}

/**
 * Create a new campus.
 */
export async function createCampus(input: CreateCampusInput) {
  const organizationId = getOrgContextId()

  // Geocode address if provided but no coordinates given
  let lat = input.latitude ?? null
  let lng = input.longitude ?? null
  if (input.address && lat == null && lng == null) {
    const geo = await geocodeAddress(input.address)
    if (geo) {
      lat = geo.lat
      lng = geo.lng
    }
  }

  return prisma.campus.create({
    data: {
      organizationId,
      name: input.name,
      address: input.address ?? null,
      latitude: lat,
      longitude: lng,
      campusType: input.campusType,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    },
    include: {
      _count: {
        select: { schools: true, buildings: true, areas: true },
      },
    },
  })
}

/**
 * Update a campus.
 */
export async function updateCampus(campusId: string, input: UpdateCampusInput) {
  const data: Record<string, unknown> = { ...input }

  // Geocode if address changed but no new coordinates provided
  if (input.address && input.latitude === undefined && input.longitude === undefined) {
    const geo = await geocodeAddress(input.address)
    if (geo) {
      data.latitude = geo.lat
      data.longitude = geo.lng
    }
  }

  return prisma.campus.update({
    where: { id: campusId },
    data,
    include: {
      _count: {
        select: { schools: true, buildings: true, areas: true },
      },
    },
  })
}

/**
 * Delete a campus (soft-delete via extension).
 * Blocks deletion if the campus has schools or buildings.
 */
export async function deleteCampus(campusId: string): Promise<{ success: boolean; reason?: string }> {
  const counts = await prisma.campus.findUnique({
    where: { id: campusId },
    include: {
      _count: {
        select: { schools: true, buildings: true },
      },
    },
  })

  if (!counts) {
    return { success: false, reason: 'Campus not found' }
  }

  if (counts._count.schools > 0) {
    return {
      success: false,
      reason: `Cannot delete campus with ${counts._count.schools} school(s). Reassign or delete them first.`,
    }
  }

  if (counts._count.buildings > 0) {
    return {
      success: false,
      reason: `Cannot delete campus with ${counts._count.buildings} building(s). Reassign or delete them first.`,
    }
  }

  await prisma.campus.delete({ where: { id: campusId } })
  return { success: true }
}

// ============= Campus Hierarchy Validation =============

/**
 * Validate that a school belongs to the specified campus.
 * Used when assigning a building to both a campus and a school.
 */
export async function validateSchoolInCampus(
  campusId: string,
  schoolId: string
): Promise<boolean> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { campusId: true },
  })
  return school?.campusId === campusId
}

// ============= User Campus Assignments =============

/**
 * List campus assignments, filterable by userId or campusId.
 */
export async function listCampusAssignments(filters: {
  userId?: string
  campusId?: string
}) {
  const where: Record<string, unknown> = { isActive: true }
  if (filters.userId) where.userId = filters.userId
  if (filters.campusId) where.campusId = filters.campusId

  return prisma.userCampusAssignment.findMany({
    where,
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
      campus: { select: { id: true, name: true, campusType: true } },
    },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  })
}

/**
 * Assign a user to a campus.
 */
export async function assignUserToCampus(input: {
  userId: string
  campusId: string
  isPrimary?: boolean
  startsAt?: string | null
  endsAt?: string | null
}) {
  const organizationId = getOrgContextId()
  return prisma.userCampusAssignment.create({
    data: {
      organizationId,
      userId: input.userId,
      campusId: input.campusId,
      isPrimary: input.isPrimary ?? false,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      isActive: true,
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      campus: { select: { id: true, name: true } },
    },
  })
}

/**
 * Update a campus assignment.
 */
export async function updateCampusAssignment(
  assignmentId: string,
  input: z.infer<typeof UpdateCampusAssignmentSchema>
) {
  const data: Record<string, unknown> = {}
  if (input.isPrimary !== undefined) data.isPrimary = input.isPrimary
  if (input.isActive !== undefined) data.isActive = input.isActive
  if (input.startsAt !== undefined) data.startsAt = input.startsAt ? new Date(input.startsAt) : null
  if (input.endsAt !== undefined) data.endsAt = input.endsAt ? new Date(input.endsAt) : null

  return prisma.userCampusAssignment.update({
    where: { id: assignmentId },
    data,
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      campus: { select: { id: true, name: true } },
    },
  })
}

/**
 * Remove a campus assignment (hard delete — no soft-delete on junction table).
 */
export async function removeCampusAssignment(assignmentId: string) {
  // UserCampusAssignment is not in softDeleteModels, so this is a real delete
  // But the extension will try to soft-delete... we need rawPrisma for hard delete
  // Actually, UserCampusAssignment is NOT in softDeleteModels, so prisma.delete works as hard-delete
  return prisma.userCampusAssignment.delete({
    where: { id: assignmentId },
  })
}

/**
 * Get all campuses a user is assigned to.
 */
export async function getUserCampuses(userId: string) {
  const assignments = await prisma.userCampusAssignment.findMany({
    where: { userId, isActive: true },
    include: {
      campus: true,
    },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  })
  return assignments.map((a) => ({
    ...a.campus,
    isPrimary: a.isPrimary,
    assignmentId: a.id,
  }))
}
