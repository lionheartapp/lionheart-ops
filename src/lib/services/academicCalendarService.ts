import { prisma, type OrgPrismaClient } from '@/lib/db'
import { cacheOrgWide, invalidateOrgCache } from '@/lib/cache/route-cache'
import { getOrgContextId } from '@/lib/org-context'

const db = prisma as unknown as OrgPrismaClient

/**
 * Academic calendar tables (academic years, terms, marking periods, bell
 * schedules, day schedule assignments, special days) cross-reference each
 * other in every list query. Every mutation in this file nukes the single
 * 'academic' bucket so no join goes stale.
 */
function invalidateAcademicCache(): void {
  invalidateOrgCache(getOrgContextId(), 'academic')
}

// ── Academic Years ─────────────────────────────────────────────────────

export async function getAcademicYears(filters?: { campusId?: string }) {
  const orgId = getOrgContextId()
  const bucket = `academic:years:school=${filters?.campusId ?? 'all'}`
  return cacheOrgWide(orgId, bucket, () =>
    db.academicYear.findMany({
      where: { ...(filters?.campusId ? { campusId: filters.campusId } : {}) },
      include: {
        campus: { select: { id: true, name: true } },
        terms: {
          orderBy: { sortOrder: 'asc' },
          include: {
            markingPeriods: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
      orderBy: { startDate: 'desc' },
    })
  )
}

export async function getAcademicYearById(id: string) {
  return db.academicYear.findUnique({
    where: { id },
    include: {
      campus: { select: { id: true, name: true } },
      terms: {
        orderBy: { sortOrder: 'asc' },
        include: {
          markingPeriods: { orderBy: { sortOrder: 'asc' } },
        },
      },
    },
  })
}

export async function createAcademicYear(data: {
  name: string
  startDate: Date
  endDate: Date
  campusId?: string
  isCurrent?: boolean
}) {
  if (data.isCurrent) {
    await db.academicYear.updateMany({
      where: { isCurrent: true },
      data: { isCurrent: false },
    })
  }
  const result = await db.academicYear.create({
    data: {
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      campusId: data.campusId || null,
      isCurrent: data.isCurrent ?? false,
    },
    include: {
      campus: { select: { id: true, name: true } },
      terms: true,
    },
  })
  invalidateAcademicCache()
  return result
}

export async function updateAcademicYear(id: string, data: {
  name?: string
  startDate?: Date
  endDate?: Date
  campusId?: string | null
  isCurrent?: boolean
}) {
  if (data.isCurrent) {
    await db.academicYear.updateMany({
      where: { isCurrent: true, id: { not: id } },
      data: { isCurrent: false },
    })
  }
  const result = await db.academicYear.update({
    where: { id },
    data,
    include: {
      campus: { select: { id: true, name: true } },
      terms: {
        orderBy: { sortOrder: 'asc' },
        include: { markingPeriods: { orderBy: { sortOrder: 'asc' } } },
      },
    },
  })
  invalidateAcademicCache()
  return result
}

export async function deleteAcademicYear(id: string) {
  const result = await db.academicYear.delete({ where: { id } })
  invalidateAcademicCache()
  return result
}

// ── Terms ──────────────────────────────────────────────────────────────

export async function getTerms(academicYearId?: string) {
  const orgId = getOrgContextId()
  const bucket = `academic:terms:year=${academicYearId ?? 'all'}`
  return cacheOrgWide(orgId, bucket, () =>
    db.term.findMany({
      where: { ...(academicYearId ? { academicYearId } : {}) },
      include: {
        academicYear: { select: { id: true, name: true } },
        markingPeriods: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { sortOrder: 'asc' },
    })
  )
}

export async function createTerm(data: {
  academicYearId: string
  name: string
  startDate: Date
  endDate: Date
  sortOrder?: number
}) {
  const result = await db.term.create({
    data: {
      academicYearId: data.academicYearId,
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      sortOrder: data.sortOrder ?? 0,
    },
    include: {
      academicYear: { select: { id: true, name: true } },
      markingPeriods: true,
    },
  })
  invalidateAcademicCache()
  return result
}

export async function updateTerm(id: string, data: {
  name?: string
  startDate?: Date
  endDate?: Date
  sortOrder?: number
}) {
  const result = await db.term.update({
    where: { id },
    data,
    include: {
      academicYear: { select: { id: true, name: true } },
      markingPeriods: { orderBy: { sortOrder: 'asc' } },
    },
  })
  invalidateAcademicCache()
  return result
}

export async function deleteTerm(id: string) {
  const result = await db.term.delete({ where: { id } })
  invalidateAcademicCache()
  return result
}

// ── Marking Periods ────────────────────────────────────────────────────

export async function createMarkingPeriod(data: {
  termId: string
  name: string
  startDate: Date
  endDate: Date
  sortOrder?: number
}) {
  const result = await db.markingPeriod.create({
    data: {
      termId: data.termId,
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      sortOrder: data.sortOrder ?? 0,
    },
  })
  invalidateAcademicCache()
  return result
}

export async function updateMarkingPeriod(id: string, data: {
  name?: string
  startDate?: Date
  endDate?: Date
  sortOrder?: number
}) {
  const result = await db.markingPeriod.update({ where: { id }, data })
  invalidateAcademicCache()
  return result
}

export async function deleteMarkingPeriod(id: string) {
  const result = await db.markingPeriod.delete({ where: { id } })
  invalidateAcademicCache()
  return result
}

// ── Bell Schedules ─────────────────────────────────────────────────────

export async function getBellSchedules(filters?: { campusId?: string }) {
  const orgId = getOrgContextId()
  const bucket = `academic:bell-schedules:school=${filters?.campusId ?? 'all'}`
  return cacheOrgWide(orgId, bucket, () =>
    db.bellSchedule.findMany({
      where: { ...(filters?.campusId ? { campusId: filters.campusId } : {}) },
      include: {
        campus: { select: { id: true, name: true } },
        periods: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { name: 'asc' },
    })
  )
}

export async function getBellScheduleById(id: string) {
  return db.bellSchedule.findUnique({
    where: { id },
    include: {
      campus: { select: { id: true, name: true } },
      periods: { orderBy: { sortOrder: 'asc' } },
    },
  })
}

export async function createBellSchedule(data: {
  name: string
  campusId?: string
  isDefault?: boolean
  daysOfWeek?: string[]
  periods?: Array<{ name: string; startTime: string; endTime: string; sortOrder?: number }>
}) {
  if (data.isDefault) {
    await db.bellSchedule.updateMany({
      where: { isDefault: true, ...(data.campusId ? { campusId: data.campusId } : {}) },
      data: { isDefault: false },
    })
  }
  const result = await db.bellSchedule.create({
    data: {
      name: data.name,
      campusId: data.campusId || null,
      isDefault: data.isDefault ?? false,
      daysOfWeek: data.daysOfWeek ?? [],
      periods: data.periods?.length
        ? { create: data.periods.map((p, i) => ({ ...p, sortOrder: p.sortOrder ?? i })) }
        : undefined,
    },
    include: {
      campus: { select: { id: true, name: true } },
      periods: { orderBy: { sortOrder: 'asc' } },
    },
  })
  invalidateAcademicCache()
  return result
}

export async function updateBellSchedule(id: string, data: {
  name?: string
  campusId?: string | null
  isDefault?: boolean
  daysOfWeek?: string[]
  periods?: Array<{ id?: string; name: string; startTime: string; endTime: string; sortOrder?: number }>
}) {
  if (data.isDefault) {
    const current = await db.bellSchedule.findUnique({ where: { id }, select: { campusId: true } })
    await db.bellSchedule.updateMany({
      where: { isDefault: true, id: { not: id }, ...(current?.campusId ? { campusId: current.campusId } : {}) },
      data: { isDefault: false },
    })
  }

  // If periods provided, delete existing and recreate
  if (data.periods) {
    await db.bellSchedulePeriod.deleteMany({ where: { bellScheduleId: id } })
    await db.bellSchedulePeriod.createMany({
      data: data.periods.map((p, i) => ({
        bellScheduleId: id,
        name: p.name,
        startTime: p.startTime,
        endTime: p.endTime,
        sortOrder: p.sortOrder ?? i,
      })),
    })
  }

  const { periods: _periods, ...updateData } = data
  const result = await db.bellSchedule.update({
    where: { id },
    data: updateData,
    include: {
      campus: { select: { id: true, name: true } },
      periods: { orderBy: { sortOrder: 'asc' } },
    },
  })
  invalidateAcademicCache()
  return result
}

export async function deleteBellSchedule(id: string) {
  const result = await db.bellSchedule.delete({ where: { id } })
  invalidateAcademicCache()
  return result
}

// ── Day Schedule Assignments ───────────────────────────────────────────

export async function getDayScheduleAssignments(filters: {
  startDate: Date
  endDate: Date
  campusId?: string
}) {
  const orgId = getOrgContextId()
  const startKey = filters.startDate.toISOString().slice(0, 10)
  const endKey = filters.endDate.toISOString().slice(0, 10)
  const bucket = `academic:day-schedules:start=${startKey}:end=${endKey}:campus=${filters.campusId ?? 'all'}`
  return cacheOrgWide(orgId, bucket, () =>
    db.dayScheduleAssignment.findMany({
      where: {
        date: { gte: filters.startDate, lte: filters.endDate },
        ...(filters.campusId ? { campusId: filters.campusId } : {}),
      },
      include: {
        bellSchedule: {
          include: { periods: { orderBy: { sortOrder: 'asc' } } },
        },
        campus: { select: { id: true, name: true } },
      },
      orderBy: { date: 'asc' },
    })
  )
}

export async function assignDaySchedule(data: {
  date: Date
  bellScheduleId: string
  campusId?: string
  organizationId: string
}) {
  const result = await db.dayScheduleAssignment.upsert({
    where: {
      organizationId_campusId_date: {
        organizationId: data.organizationId,
        campusId: data.campusId || null,
        date: data.date,
      },
    },
    create: {
      date: data.date,
      bellScheduleId: data.bellScheduleId,
      campusId: data.campusId || null,
    },
    update: {
      bellScheduleId: data.bellScheduleId,
    },
    include: {
      bellSchedule: {
        include: { periods: { orderBy: { sortOrder: 'asc' } } },
      },
    },
  })
  invalidateAcademicCache()
  return result
}

export async function removeDayScheduleAssignment(id: string) {
  const result = await db.dayScheduleAssignment.delete({ where: { id } })
  invalidateAcademicCache()
  return result
}

// ── Special Days ───────────────────────────────────────────────────────

export async function getSpecialDays(filters?: {
  startDate?: Date
  endDate?: Date
  campusId?: string
}) {
  const orgId = getOrgContextId()
  const startKey = filters?.startDate ? filters.startDate.toISOString() : 'none'
  const endKey = filters?.endDate ? filters.endDate.toISOString() : 'none'
  const bucket =
    `academic:special-days:s=${startKey}:e=${endKey}` +
    `:campus=${filters?.campusId ?? 'all'}`
  return cacheOrgWide(orgId, bucket, () =>
    db.specialDay.findMany({
      where: {
        ...(filters?.startDate && filters?.endDate
          ? { date: { gte: filters.startDate, lte: filters.endDate } }
          : {}),
        ...(filters?.campusId ? { campusId: filters.campusId } : {}),
      },
      include: {
        campus: { select: { id: true, name: true } },
      },
      orderBy: { date: 'asc' },
    })
  )
}

export async function createSpecialDay(data: {
  date: Date
  endDate?: Date | null
  name: string
  specialDayType: string
  campusId?: string
  isAllSchools?: boolean
}) {
  const result = await db.specialDay.create({
    data: {
      date: data.date,
      endDate: data.endDate || null,
      name: data.name,
      specialDayType: data.specialDayType,
      campusId: data.campusId || null,
      isAllSchools: data.isAllSchools ?? true,
    },
    include: {
      campus: { select: { id: true, name: true } },
    },
  })
  invalidateAcademicCache()
  return result
}

export async function updateSpecialDay(id: string, data: {
  date?: Date
  name?: string
  specialDayType?: string
  campusId?: string | null
  isAllSchools?: boolean
}) {
  const result = await db.specialDay.update({
    where: { id },
    data,
    include: {
      campus: { select: { id: true, name: true } },
    },
  })
  invalidateAcademicCache()
  return result
}

export async function deleteSpecialDay(id: string) {
  const result = await db.specialDay.delete({ where: { id } })
  invalidateAcademicCache()
  return result
}

// ── Query helpers for calendar views ───────────────────────────────────

export async function getBellScheduleForDate(date: Date, campusId?: string) {
  const assignment = await db.dayScheduleAssignment.findFirst({
    where: {
      date,
      ...(campusId ? { campusId } : {}),
    },
    include: {
      bellSchedule: {
        include: { periods: { orderBy: { sortOrder: 'asc' } } },
      },
    },
  })

  if (assignment) return assignment.bellSchedule

  // Fall back to default bell schedule
  return db.bellSchedule.findFirst({
    where: { isDefault: true },
    include: { periods: { orderBy: { sortOrder: 'asc' } } },
  })
}

export async function getSpecialDaysInRange(startDate: Date, endDate: Date, campusId?: string) {
  return db.specialDay.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      ...(campusId ? { OR: [{ campusId }, { isAllSchools: true }] } : {}),
    },
    orderBy: { date: 'asc' },
  })
}
