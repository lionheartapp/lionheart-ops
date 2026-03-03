import { prisma } from '@/lib/db'

const db = prisma as any

// ── Academic Years ─────────────────────────────────────────────────────

export async function getAcademicYears(filters?: { schoolId?: string }) {
  return db.academicYear.findMany({
    where: { ...(filters?.schoolId ? { schoolId: filters.schoolId } : {}) },
    include: {
      school: { select: { id: true, name: true } },
      terms: {
        orderBy: { sortOrder: 'asc' },
        include: {
          markingPeriods: { orderBy: { sortOrder: 'asc' } },
        },
      },
    },
    orderBy: { startDate: 'desc' },
  })
}

export async function getAcademicYearById(id: string) {
  return db.academicYear.findUnique({
    where: { id },
    include: {
      school: { select: { id: true, name: true } },
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
  schoolId?: string
  isCurrent?: boolean
}) {
  if (data.isCurrent) {
    await db.academicYear.updateMany({
      where: { isCurrent: true },
      data: { isCurrent: false },
    })
  }
  return db.academicYear.create({
    data: {
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      schoolId: data.schoolId || null,
      isCurrent: data.isCurrent ?? false,
    },
    include: {
      school: { select: { id: true, name: true } },
      terms: true,
    },
  })
}

export async function updateAcademicYear(id: string, data: {
  name?: string
  startDate?: Date
  endDate?: Date
  schoolId?: string | null
  isCurrent?: boolean
}) {
  if (data.isCurrent) {
    await db.academicYear.updateMany({
      where: { isCurrent: true, id: { not: id } },
      data: { isCurrent: false },
    })
  }
  return db.academicYear.update({
    where: { id },
    data,
    include: {
      school: { select: { id: true, name: true } },
      terms: {
        orderBy: { sortOrder: 'asc' },
        include: { markingPeriods: { orderBy: { sortOrder: 'asc' } } },
      },
    },
  })
}

export async function deleteAcademicYear(id: string) {
  return db.academicYear.delete({ where: { id } })
}

// ── Terms ──────────────────────────────────────────────────────────────

export async function getTerms(academicYearId?: string) {
  return db.term.findMany({
    where: { ...(academicYearId ? { academicYearId } : {}) },
    include: {
      academicYear: { select: { id: true, name: true } },
      markingPeriods: { orderBy: { sortOrder: 'asc' } },
    },
    orderBy: { sortOrder: 'asc' },
  })
}

export async function createTerm(data: {
  academicYearId: string
  name: string
  startDate: Date
  endDate: Date
  sortOrder?: number
}) {
  return db.term.create({
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
}

export async function updateTerm(id: string, data: {
  name?: string
  startDate?: Date
  endDate?: Date
  sortOrder?: number
}) {
  return db.term.update({
    where: { id },
    data,
    include: {
      academicYear: { select: { id: true, name: true } },
      markingPeriods: { orderBy: { sortOrder: 'asc' } },
    },
  })
}

export async function deleteTerm(id: string) {
  return db.term.delete({ where: { id } })
}

// ── Marking Periods ────────────────────────────────────────────────────

export async function createMarkingPeriod(data: {
  termId: string
  name: string
  startDate: Date
  endDate: Date
  sortOrder?: number
}) {
  return db.markingPeriod.create({
    data: {
      termId: data.termId,
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      sortOrder: data.sortOrder ?? 0,
    },
  })
}

export async function updateMarkingPeriod(id: string, data: {
  name?: string
  startDate?: Date
  endDate?: Date
  sortOrder?: number
}) {
  return db.markingPeriod.update({ where: { id }, data })
}

export async function deleteMarkingPeriod(id: string) {
  return db.markingPeriod.delete({ where: { id } })
}

// ── Bell Schedules ─────────────────────────────────────────────────────

export async function getBellSchedules(filters?: { schoolId?: string }) {
  return db.bellSchedule.findMany({
    where: { ...(filters?.schoolId ? { schoolId: filters.schoolId } : {}) },
    include: {
      school: { select: { id: true, name: true } },
      periods: { orderBy: { sortOrder: 'asc' } },
    },
    orderBy: { name: 'asc' },
  })
}

export async function getBellScheduleById(id: string) {
  return db.bellSchedule.findUnique({
    where: { id },
    include: {
      school: { select: { id: true, name: true } },
      periods: { orderBy: { sortOrder: 'asc' } },
    },
  })
}

export async function createBellSchedule(data: {
  name: string
  schoolId?: string
  isDefault?: boolean
  periods?: Array<{ name: string; startTime: string; endTime: string; sortOrder?: number }>
}) {
  if (data.isDefault) {
    await db.bellSchedule.updateMany({
      where: { isDefault: true, ...(data.schoolId ? { schoolId: data.schoolId } : {}) },
      data: { isDefault: false },
    })
  }
  return db.bellSchedule.create({
    data: {
      name: data.name,
      schoolId: data.schoolId || null,
      isDefault: data.isDefault ?? false,
      periods: data.periods?.length
        ? { create: data.periods.map((p, i) => ({ ...p, sortOrder: p.sortOrder ?? i })) }
        : undefined,
    },
    include: {
      school: { select: { id: true, name: true } },
      periods: { orderBy: { sortOrder: 'asc' } },
    },
  })
}

export async function updateBellSchedule(id: string, data: {
  name?: string
  schoolId?: string | null
  isDefault?: boolean
  periods?: Array<{ id?: string; name: string; startTime: string; endTime: string; sortOrder?: number }>
}) {
  if (data.isDefault) {
    const current = await db.bellSchedule.findUnique({ where: { id }, select: { schoolId: true } })
    await db.bellSchedule.updateMany({
      where: { isDefault: true, id: { not: id }, ...(current?.schoolId ? { schoolId: current.schoolId } : {}) },
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
  return db.bellSchedule.update({
    where: { id },
    data: updateData,
    include: {
      school: { select: { id: true, name: true } },
      periods: { orderBy: { sortOrder: 'asc' } },
    },
  })
}

export async function deleteBellSchedule(id: string) {
  return db.bellSchedule.delete({ where: { id } })
}

// ── Day Schedule Assignments ───────────────────────────────────────────

export async function getDayScheduleAssignments(filters: {
  startDate: Date
  endDate: Date
  campusId?: string
}) {
  return db.dayScheduleAssignment.findMany({
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
}

export async function assignDaySchedule(data: {
  date: Date
  bellScheduleId: string
  campusId?: string
  organizationId: string
}) {
  return db.dayScheduleAssignment.upsert({
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
}

export async function removeDayScheduleAssignment(id: string) {
  return db.dayScheduleAssignment.delete({ where: { id } })
}

// ── Special Days ───────────────────────────────────────────────────────

export async function getSpecialDays(filters?: {
  startDate?: Date
  endDate?: Date
  schoolId?: string
  campusId?: string
}) {
  return db.specialDay.findMany({
    where: {
      ...(filters?.startDate && filters?.endDate
        ? { date: { gte: filters.startDate, lte: filters.endDate } }
        : {}),
      ...(filters?.schoolId ? { schoolId: filters.schoolId } : {}),
      ...(filters?.campusId ? { campusId: filters.campusId } : {}),
    },
    include: {
      school: { select: { id: true, name: true } },
      campus: { select: { id: true, name: true } },
    },
    orderBy: { date: 'asc' },
  })
}

export async function createSpecialDay(data: {
  date: Date
  name: string
  specialDayType: string
  schoolId?: string
  campusId?: string
  isAllSchools?: boolean
}) {
  return db.specialDay.create({
    data: {
      date: data.date,
      name: data.name,
      specialDayType: data.specialDayType,
      schoolId: data.schoolId || null,
      campusId: data.campusId || null,
      isAllSchools: data.isAllSchools ?? true,
    },
    include: {
      school: { select: { id: true, name: true } },
      campus: { select: { id: true, name: true } },
    },
  })
}

export async function updateSpecialDay(id: string, data: {
  date?: Date
  name?: string
  specialDayType?: string
  schoolId?: string | null
  campusId?: string | null
  isAllSchools?: boolean
}) {
  return db.specialDay.update({
    where: { id },
    data,
    include: {
      school: { select: { id: true, name: true } },
      campus: { select: { id: true, name: true } },
    },
  })
}

export async function deleteSpecialDay(id: string) {
  return db.specialDay.delete({ where: { id } })
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
