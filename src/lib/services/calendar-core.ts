/**
 * Calendar Service — Calendar CRUD & Location Conflict Detection
 *
 * Calendar management (create, update, delete) and location-based
 * conflict checking with configurable buffer times.
 */

import { prisma } from '@/lib/db'
import { rawPrisma } from '@/lib/db'
import { getOrgContextId } from '@/lib/org-context'
import type {
  CalendarType,
  Prisma,
} from '@prisma/client'

// ─── Calendar CRUD ─────────────────────────────────────────────────────

export async function getCalendars(filters?: {
  calendarType?: string
  campusId?: string
  schoolId?: string
  isActive?: boolean
  userId?: string
  roleName?: string
}) {
  const where: Prisma.CalendarWhereInput = {}

  if (filters?.calendarType) {
    where.calendarType = filters.calendarType as CalendarType
  }
  if (filters?.campusId) {
    where.campusId = filters.campusId
  }
  if (filters?.schoolId) {
    where.schoolId = filters.schoolId
  }
  if (filters?.isActive !== undefined) {
    where.isActive = filters.isActive
  }

  // Filter personal calendars so each user only sees their own "My Schedule"
  const isAdmin = filters?.roleName && ['super admin', 'super-admin', 'administrator', 'admin'].includes(filters.roleName.toLowerCase())
  if (filters?.userId) {
    if (isAdmin) {
      // Admins see all non-personal calendars + only their own personal calendar
      where.OR = [
        { calendarType: { not: 'PERSONAL' } },
        { createdById: filters.userId, calendarType: 'PERSONAL' },
      ]
    } else {
      // Non-admins: filter by campus assignments + own personal calendar
      const campusAssignments = await prisma.userCampusAssignment.findMany({
        where: { userId: filters.userId, isActive: true },
        select: { campusId: true },
      })
      const userCampusIds = campusAssignments.map((a) => a.campusId)

      where.OR = [
        // Campus master calendars the user belongs to
        ...(userCampusIds.length > 0
          ? [{ campusId: { in: userCampusIds }, calendarType: { not: 'PERSONAL' as CalendarType } }]
          : []),
        // Org-wide calendars (no campus, non-personal)
        { campusId: null, calendarType: { not: 'PERSONAL' as CalendarType } },
        // User's own personal calendar
        { createdById: filters.userId, calendarType: 'PERSONAL' },
      ]
    }
  }

  return prisma.calendar.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      campus: { select: { id: true, name: true } },
      school: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, firstName: true, lastName: true } },
      _count: { select: { events: true, subscriptions: true } },
    },
  })
}

export async function getCalendarById(id: string) {
  return prisma.calendar.findUnique({
    where: { id },
    include: {
      campus: { select: { id: true, name: true } },
      school: { select: { id: true, name: true } },
      categories: true,
      _count: { select: { events: true, subscriptions: true } },
    },
  })
}

export async function createCalendar(data: {
  name: string
  slug: string
  calendarType: string
  color?: string
  visibility?: string
  requiresApproval?: boolean
  campusId?: string
  schoolId?: string
  isDefault?: boolean
  createdById?: string
}) {
  // Default calendar color to the school's color when schoolId is provided and no explicit color
  let resolvedColor = data.color
  if (!resolvedColor && data.schoolId) {
    const school = await prisma.school.findUnique({
      where: { id: data.schoolId },
      select: { color: true },
    })
    if (school?.color) {
      resolvedColor = school.color
    }
  }

  return (prisma.calendar.create as Function)({
    data: {
      name: data.name,
      slug: data.slug,
      calendarType: data.calendarType,
      color: resolvedColor || '#3b82f6',
      visibility: data.visibility || 'ORG_WIDE',
      requiresApproval: data.requiresApproval || false,
      campusId: data.campusId,
      schoolId: data.schoolId,
      isDefault: data.isDefault || false,
      createdById: data.createdById,
    },
  })
}

export async function updateCalendar(id: string, data: Partial<{
  name: string
  slug: string
  color: string
  visibility: string
  requiresApproval: boolean
  isDefault: boolean
  isActive: boolean
}>) {
  return (prisma.calendar.update as Function)({
    where: { id },
    data,
  })
}

export async function deleteCalendar(id: string) {
  return prisma.calendar.delete({ where: { id } })
}

// ─── Location Conflict Detection ────────────────────────────────────────

export class LocationConflictError extends Error {
  code = 'LOCATION_CONFLICT' as const
  details: {
    conflictingEventId: string
    conflictingEventTitle: string
    conflictingStart: string
    conflictingEnd: string
    bufferMinutes: number
    location: string
  }
  constructor(details: LocationConflictError['details']) {
    super(`Location conflict with "${details.conflictingEventTitle}"`)
    this.details = details
  }
}

/**
 * Check if an event at the given time + location conflicts with an existing event
 * (including the org's configured buffer time on both sides).
 */
export async function checkLocationConflict(opts: {
  startTime: Date
  endTime: Date
  buildingId?: string | null
  areaId?: string | null
  locationText?: string
  excludeEventId?: string
}): Promise<{ hasConflict: false } | { hasConflict: true; conflictingEvent: { id: string; title: string; startTime: Date; endTime: Date; location: string } ; bufferMinutes: number }> {
  const { startTime, endTime, buildingId, areaId, locationText, excludeEventId } = opts

  // No location data → skip check
  if (!buildingId && !areaId && !locationText) {
    return { hasConflict: false }
  }

  // Fetch org buffer setting
  const orgId = getOrgContextId()
  if (!orgId) return { hasConflict: false }

  const org = await rawPrisma.organization.findUnique({
    where: { id: orgId },
    select: { eventBufferMinutes: true },
  })
  const bufferMinutes = org?.eventBufferMinutes ?? 60
  if (bufferMinutes <= 0) return { hasConflict: false }

  const bufferMs = bufferMinutes * 60_000
  const windowStart = new Date(startTime.getTime() - bufferMs)
  const windowEnd = new Date(endTime.getTime() + bufferMs)

  // Build location match clause (tiered)
  const locationWhere: Prisma.CalendarEventWhereInput = buildingId && areaId
    ? { buildingId, areaId }
    : buildingId
      ? { buildingId, areaId: null }
      : areaId
        ? { areaId, buildingId: null }
        : { locationText: { equals: locationText!, mode: 'insensitive' } }

  const where: Prisma.CalendarEventWhereInput = {
    ...locationWhere,
    // Event overlaps with expanded window
    startTime: { lt: windowEnd },
    endTime: { gt: windowStart },
    // Don't conflict with self
    ...(excludeEventId ? { id: { not: excludeEventId } } : {}),
    // Only check confirmed/pending events, not cancelled/draft
    calendarStatus: { in: ['CONFIRMED', 'PENDING_APPROVAL'] },
  }

  const conflict = await prisma.calendarEvent.findFirst({
    where,
    select: {
      id: true,
      title: true,
      startTime: true,
      endTime: true,
      locationText: true,
      building: { select: { name: true } },
      area: { select: { name: true } },
    },
    orderBy: { startTime: 'asc' },
  })

  if (!conflict) return { hasConflict: false }

  const location = [conflict.building?.name, conflict.area?.name].filter(Boolean).join(' — ')
    || conflict.locationText
    || 'Same location'

  return {
    hasConflict: true,
    conflictingEvent: {
      id: conflict.id,
      title: conflict.title,
      startTime: conflict.startTime,
      endTime: conflict.endTime,
      location,
    },
    bufferMinutes,
  }
}
