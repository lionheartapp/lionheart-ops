/**
 * Campus Service
 *
 * Handles CRUD for Campus records (physical sub-locations under a School).
 *
 * NEW ONTOLOGY (post Phase 1 restructure):
 *   District → School → Campus → Building → Space → Room
 *
 *   - Campus is a PHYSICAL sub-location under a School (the institution).
 *   - A Campus may be pinned to a Site (shared physical address among campuses).
 *   - User ↔ Campus is now a direct one-to-many relation (User.campusId) —
 *     the old UserCampusAssignment junction has been dropped.
 *
 * Used by API routes inside runWithOrgContext — uses org-scoped `prisma`.
 */

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getOrgContextId } from '@/lib/org-context'
import { geocodeAddress } from '@/lib/services/geocodingService'

// Distinct calendar color palette — ordered for maximum visual separation
const CALENDAR_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f97316', // orange
  '#a855f7', // purple
  '#ef4444', // red
  '#14b8a6', // teal
  '#f59e0b', // amber
  '#ec4899', // pink
  '#6366f1', // indigo (reserved for personal calendars)
  '#64748b', // slate
]

/** Pick the next unused color from the palette based on existing calendars in the org */
async function pickNextCalendarColor(): Promise<string> {
  const existing = await prisma.calendar.findMany({
    where: { deletedAt: null },
    select: { color: true },
  })
  const usedColors = new Set(existing.map((c) => c.color))
  const available = CALENDAR_COLORS.find((c) => !usedColors.has(c))
  // If all colors used, cycle back to the first
  return available ?? CALENDAR_COLORS[existing.length % CALENDAR_COLORS.length]
}

// ============= Validation Schemas =============

export const CreateCampusSchema = z.object({
  name: z.string().trim().min(1, 'Campus name is required').max(120),
  schoolId: z.string().min(1).optional().nullable(),
  siteId: z.string().min(1).optional().nullable(),
  address: z.string().trim().max(400).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  gradeLevel: z.enum(['ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL']).optional().nullable(),
  campusKind: z.enum(['HEADQUARTERS', 'CAMPUS', 'SATELLITE']).default('CAMPUS'),
  color: z.string().trim().optional(),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
})

export const UpdateCampusSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  schoolId: z.string().min(1).optional().nullable(),
  siteId: z.string().min(1).optional().nullable(),
  address: z.string().trim().max(400).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  gradeLevel: z.enum(['ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL']).optional().nullable(),
  campusKind: z.enum(['HEADQUARTERS', 'CAMPUS', 'SATELLITE']).optional(),
  color: z.string().trim().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

export type CreateCampusInput = z.infer<typeof CreateCampusSchema>
export type UpdateCampusInput = z.infer<typeof UpdateCampusSchema>

// ============= Campus CRUD =============

/**
 * List all campuses for the current org (auto-scoped via prisma extension).
 * Includes counts of buildings, spaces, and pinned users per campus.
 */
export async function listCampuses() {
  return prisma.campus.findMany({
    include: {
      school: { select: { id: true, name: true } },
      site: { select: { id: true, label: true, address: true } },
      _count: {
        select: { buildings: true, spaces: true, users: true },
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
      school: { select: { id: true, name: true } },
      site: { select: { id: true, label: true, address: true } },
      _count: {
        select: { buildings: true, spaces: true, users: true },
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
    where: { campusKind: 'HEADQUARTERS', isActive: true },
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

  const campus = await prisma.campus.create({
    data: {
      organizationId,
      name: input.name,
      schoolId: input.schoolId ?? null,
      siteId: input.siteId ?? null,
      address: input.address ?? null,
      latitude: lat,
      longitude: lng,
      gradeLevel: input.gradeLevel ?? null,
      campusKind: input.campusKind,
      color: input.color ?? '#3b82f6',
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    },
    include: {
      school: { select: { id: true, name: true } },
      site: { select: { id: true, label: true, address: true } },
      _count: {
        select: { buildings: true, spaces: true, users: true },
      },
    },
  })

  // Auto-create a master calendar for the new campus with a distinct color
  const calColor = await pickNextCalendarColor()
  await (prisma.calendar.create as Function)({
    data: {
      name: `${input.name} Master`,
      slug: `master-${campus.id.slice(-8)}`,
      calendarType: 'GENERAL',
      visibility: 'CAMPUS',
      campusId: campus.id,
      isDefault: true,
      color: calColor,
    },
  })

  return campus
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
      school: { select: { id: true, name: true } },
      site: { select: { id: true, label: true, address: true } },
      _count: {
        select: { buildings: true, spaces: true, users: true },
      },
    },
  })
}

/**
 * Delete a campus (soft-delete via extension).
 * Blocks deletion if the campus has buildings, spaces, or pinned users.
 */
export async function deleteCampus(campusId: string): Promise<{ success: boolean; reason?: string }> {
  const counts = await prisma.campus.findUnique({
    where: { id: campusId },
    include: {
      _count: {
        select: { buildings: true, spaces: true, users: true },
      },
    },
  })

  if (!counts) {
    return { success: false, reason: 'Campus not found' }
  }

  if (counts._count.buildings > 0) {
    return {
      success: false,
      reason: `Cannot delete campus with ${counts._count.buildings} building(s). Reassign or delete them first.`,
    }
  }

  if (counts._count.spaces > 0) {
    return {
      success: false,
      reason: `Cannot delete campus with ${counts._count.spaces} space(s). Reassign or delete them first.`,
    }
  }

  if (counts._count.users > 0) {
    return {
      success: false,
      reason: `Cannot delete campus with ${counts._count.users} pinned user(s). Reassign them first.`,
    }
  }

  await prisma.campus.delete({ where: { id: campusId } })
  return { success: true }
}

// ============= Campus ↔ School Validation =============

/**
 * Validate that a campus belongs to the specified school.
 *
 * NEW ONTOLOGY: Campus has schoolId (Campus is under School), not the reverse.
 * Used e.g. when placing a Building under both a Campus and a School to ensure
 * the parent chain is coherent.
 */
export async function validateCampusInSchool(
  campusId: string,
  schoolId: string
): Promise<boolean> {
  const campus = await prisma.campus.findUnique({
    where: { id: campusId },
    select: { schoolId: true },
  })
  return campus?.schoolId === schoolId
}

// ============= User ↔ Campus Helpers =============
//
// User ↔ Campus is now a direct one-to-many relation (User.campusId). The old
// UserCampusAssignment junction table has been dropped in Phase 1b. Callers
// that previously used listCampusAssignments / assignUserToCampus / etc. should
// now update User.campusId directly (see userService).

/**
 * List users pinned to a given campus (replacement for listCampusAssignments).
 */
export async function listUsersOnCampus(campusId: string) {
  return prisma.user.findMany({
    where: { campusId, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatar: true,
      campusId: true,
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })
}

/**
 * Get the campus a user is pinned to (or null). Replacement for getUserCampuses —
 * in the new model users belong to a single primary campus.
 */
export async function getUserCampus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { campusId: true },
  })
  if (!user?.campusId) return null
  return prisma.campus.findUnique({
    where: { id: user.campusId },
    include: {
      school: { select: { id: true, name: true } },
    },
  })
}
