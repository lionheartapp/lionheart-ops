/**
 * Maintenance Analytics Service
 *
 * 8 aggregation query functions covering the full analytics dashboard:
 *   ANALYTICS-01: Tickets by status per campus
 *   ANALYTICS-02: Average resolution time by category
 *   ANALYTICS-03: Technician workload (active tickets + hours)
 *   ANALYTICS-04: PM compliance rate
 *   ANALYTICS-05: Labor hours by month
 *   ANALYTICS-06: Cost by building per month
 *   ANALYTICS-07: Top 10 ticket locations
 *   ANALYTICS-08: Category breakdown
 *
 * All functions use rawPrisma (bypass org-scope) and apply
 * organizationId + deletedAt filters manually.
 */

import { rawPrisma } from '@/lib/db'
import { startOfDay, subMonths, startOfWeek, startOfMonth, format } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalyticsOptions {
  campusId?: string
  schoolId?: string
  months?: number
}

// ANALYTICS-01
export interface TicketsByStatusResult {
  statuses: string[]
  campuses: { campusId: string; campusName: string; counts: Record<string, number> }[]
}

// ANALYTICS-02
export interface ResolutionTimeResult {
  category: string
  avgHours: number
}

// ANALYTICS-03
export interface TechnicianWorkloadResult {
  technicianId: string
  name: string
  activeTickets: number
  hoursThisWeek: number
  hoursThisMonth: number
}

// ANALYTICS-04
export interface PmComplianceResult {
  completedOnTime: number
  overdue: number
  pending: number
  complianceRate: number
}

// ANALYTICS-05
export interface LaborHoursByMonthResult {
  month: string
  buildings: { buildingName: string; hours: number }[]
}

// ANALYTICS-06
export interface CostByBuildingResult {
  month: string
  buildings: { buildingName: string; laborCost: number; materialsCost: number; total: number }[]
}

// ANALYTICS-07
export interface TopLocationResult {
  rank: number
  locationLabel: string
  ticketCount: number
}

// ANALYTICS-08
export interface CategoryBreakdownResult {
  category: string
  count: number
  pct: number
}

export interface AllAnalyticsResult {
  ticketsByStatus: TicketsByStatusResult
  resolutionTimeByCategory: ResolutionTimeResult[]
  technicianWorkload: TechnicianWorkloadResult[]
  pmCompliance: PmComplianceResult
  laborHoursByMonth: LaborHoursByMonthResult[]
  costByBuilding: CostByBuildingResult[]
  topLocations: TopLocationResult[]
  categoryBreakdown: CategoryBreakdownResult[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALL_STATUSES = [
  'BACKLOG', 'TODO', 'IN_PROGRESS', 'ON_HOLD', 'SCHEDULED', 'QA', 'DONE', 'CANCELLED',
] as const

function getCutoff(months: number): Date {
  return subMonths(startOfDay(new Date()), months)
}

async function getSchoolIdsForCampus(campusId: string): Promise<string[]> {
  const schools = await rawPrisma.school.findMany({
    where: { campusId, deletedAt: null },
    select: { id: true },
  })
  return schools.map((s) => s.id)
}

// ─── ANALYTICS-01: Tickets by Status per Campus ───────────────────────────────

export async function getTicketsByStatus(
  orgId: string,
  opts: AnalyticsOptions = {}
): Promise<TicketsByStatusResult> {
  const { campusId } = opts

  // Resolve school IDs for campus filter
  let schoolIdFilter: string[] | undefined
  if (campusId) {
    schoolIdFilter = await getSchoolIdsForCampus(campusId)
    if (schoolIdFilter.length === 0) {
      return { statuses: [...ALL_STATUSES], campuses: [] }
    }
  }

  // Group tickets by status + schoolId
  const grouped = await rawPrisma.maintenanceTicket.groupBy({
    by: ['status', 'schoolId'],
    where: {
      organizationId: orgId,
      deletedAt: null,
      ...(schoolIdFilter ? { schoolId: { in: schoolIdFilter } } : {}),
    },
    _count: { id: true },
  })

  // Get school names
  const schoolIds = [...new Set(grouped.map((g) => g.schoolId).filter(Boolean) as string[])]
  const schools = schoolIds.length > 0
    ? await rawPrisma.school.findMany({
        where: { id: { in: schoolIds }, deletedAt: null },
        select: { id: true, name: true, campusId: true },
      })
    : []

  // Build campus -> school map; group unknown tickets as "All Campuses"
  const schoolMap = new Map(schools.map((s) => [s.id, s]))

  const campusAccum: Map<string, { campusName: string; counts: Record<string, number> }> = new Map()

  // Always include "No Campus" bucket for tickets without schoolId
  const allEntry = { campusName: 'All Campuses', counts: {} as Record<string, number> }
  campusAccum.set('__all__', allEntry)

  for (const row of grouped) {
    const school = row.schoolId ? schoolMap.get(row.schoolId) : null
    const campusKey = school?.campusId ?? '__all__'
    const campusName = school ? school.name : 'All Campuses'

    if (!campusAccum.has(campusKey)) {
      campusAccum.set(campusKey, { campusName, counts: {} })
    }
    const entry = campusAccum.get(campusKey)!
    entry.counts[row.status] = (entry.counts[row.status] ?? 0) + row._count.id
  }

  const campuses = [...campusAccum.entries()]
    .filter(([, v]) => Object.keys(v.counts).length > 0)
    .map(([campusId, v]) => ({ campusId, campusName: v.campusName, counts: v.counts }))

  return { statuses: [...ALL_STATUSES], campuses }
}

// ─── ANALYTICS-02: Resolution Time by Category ────────────────────────────────

export async function getResolutionTimeByCategory(
  orgId: string,
  opts: AnalyticsOptions = {}
): Promise<ResolutionTimeResult[]> {
  const { months = 6, campusId } = opts
  const cutoff = getCutoff(months)

  let schoolIdFilter: string[] | undefined
  if (campusId) {
    schoolIdFilter = await getSchoolIdsForCampus(campusId)
    if (schoolIdFilter.length === 0) return []
  }

  const tickets = await rawPrisma.maintenanceTicket.findMany({
    where: {
      organizationId: orgId,
      status: 'DONE',
      deletedAt: null,
      createdAt: { gte: cutoff },
      ...(schoolIdFilter ? { schoolId: { in: schoolIdFilter } } : {}),
    },
    select: { category: true, createdAt: true, updatedAt: true },
  })

  // Group by category, compute average resolution hours
  const catMap: Map<string, { totalHours: number; count: number }> = new Map()
  for (const t of tickets) {
    const hours = (t.updatedAt.getTime() - t.createdAt.getTime()) / 3_600_000
    if (hours < 0) continue // skip invalid data
    const existing = catMap.get(t.category)
    if (existing) {
      existing.totalHours += hours
      existing.count++
    } else {
      catMap.set(t.category, { totalHours: hours, count: 1 })
    }
  }

  return [...catMap.entries()]
    .map(([category, { totalHours, count }]) => ({
      category,
      avgHours: Math.round((totalHours / count) * 10) / 10,
    }))
    .sort((a, b) => b.avgHours - a.avgHours)
}

// ─── ANALYTICS-03: Technician Workload ───────────────────────────────────────

export async function getTechnicianWorkload(
  orgId: string,
  opts: AnalyticsOptions = {}
): Promise<TechnicianWorkloadResult[]> {
  const { campusId } = opts
  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const monthStart = startOfMonth(now)

  let schoolIdFilter: string[] | undefined
  if (campusId) {
    schoolIdFilter = await getSchoolIdsForCampus(campusId)
    if (schoolIdFilter.length === 0) return []
  }

  // Active ticket counts per assignee
  const ticketGroups = await rawPrisma.maintenanceTicket.groupBy({
    by: ['assignedToId'],
    where: {
      organizationId: orgId,
      deletedAt: null,
      status: { notIn: ['DONE', 'CANCELLED'] },
      assignedToId: { not: null },
      ...(schoolIdFilter ? { schoolId: { in: schoolIdFilter } } : {}),
    },
    _count: { id: true },
  })

  // Labor hours this week and this month
  const laborWeek = await rawPrisma.maintenanceLaborEntry.groupBy({
    by: ['technicianId'],
    where: {
      organizationId: orgId,
      startTime: { gte: weekStart },
    },
    _sum: { durationMinutes: true },
  })

  const laborMonth = await rawPrisma.maintenanceLaborEntry.groupBy({
    by: ['technicianId'],
    where: {
      organizationId: orgId,
      startTime: { gte: monthStart },
    },
    _sum: { durationMinutes: true },
  })

  // Collect all technician IDs
  const techIds = [
    ...new Set([
      ...ticketGroups.map((g) => g.assignedToId!),
      ...laborWeek.map((l) => l.technicianId),
      ...laborMonth.map((l) => l.technicianId),
    ]),
  ]

  if (techIds.length === 0) return []

  // Get user names
  const users = await rawPrisma.user.findMany({
    where: { id: { in: techIds }, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  })
  const userMap = new Map(users.map((u) => [u.id, u]))

  const weekMap = new Map(laborWeek.map((l) => [l.technicianId, l._sum.durationMinutes ?? 0]))
  const monthMap = new Map(laborMonth.map((l) => [l.technicianId, l._sum.durationMinutes ?? 0]))
  const ticketMap = new Map(ticketGroups.map((g) => [g.assignedToId!, g._count.id]))

  return techIds
    .map((id) => {
      const user = userMap.get(id)
      return {
        technicianId: id,
        name: user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : id,
        activeTickets: ticketMap.get(id) ?? 0,
        hoursThisWeek: Math.round(((weekMap.get(id) ?? 0) / 60) * 10) / 10,
        hoursThisMonth: Math.round(((monthMap.get(id) ?? 0) / 60) * 10) / 10,
      }
    })
    .sort((a, b) => b.activeTickets - a.activeTickets)
}

// ─── ANALYTICS-04: PM Compliance Rate ────────────────────────────────────────

export async function getPmComplianceRate(
  orgId: string,
  opts: AnalyticsOptions = {}
): Promise<PmComplianceResult> {
  const { campusId } = opts
  const now = new Date()

  let schoolIdFilter: string[] | undefined
  if (campusId) {
    schoolIdFilter = await getSchoolIdsForCampus(campusId)
    if (schoolIdFilter.length === 0) {
      return { completedOnTime: 0, overdue: 0, pending: 0, complianceRate: 0 }
    }
  }

  const pmTickets = await rawPrisma.maintenanceTicket.findMany({
    where: {
      organizationId: orgId,
      pmScheduleId: { not: null },
      pmScheduledDueDate: { lte: now },
      deletedAt: null,
      ...(schoolIdFilter ? { schoolId: { in: schoolIdFilter } } : {}),
    },
    select: { status: true, pmScheduledDueDate: true, updatedAt: true },
  })

  let completedOnTime = 0
  let overdue = 0
  let pending = 0

  for (const t of pmTickets) {
    const dueDate = t.pmScheduledDueDate!
    if (t.status === 'DONE') {
      if (t.updatedAt <= dueDate) {
        completedOnTime++
      } else {
        overdue++
      }
    } else if (t.status === 'CANCELLED') {
      // Skip cancelled
    } else {
      // Not done and past due
      if (dueDate < now) {
        overdue++
      } else {
        pending++
      }
    }
  }

  const total = completedOnTime + overdue + pending
  const complianceRate = total > 0 ? Math.round((completedOnTime / (completedOnTime + overdue)) * 100) : 100

  return { completedOnTime, overdue, pending, complianceRate }
}

// ─── ANALYTICS-05: Labor Hours by Month ──────────────────────────────────────

export async function getLaborHoursByMonth(
  orgId: string,
  opts: AnalyticsOptions = {}
): Promise<LaborHoursByMonthResult[]> {
  const { months = 6, campusId } = opts
  const cutoff = getCutoff(months)

  let schoolIdFilter: string[] | undefined
  if (campusId) {
    schoolIdFilter = await getSchoolIdsForCampus(campusId)
    if (schoolIdFilter.length === 0) return []
  }

  const entries = await rawPrisma.maintenanceLaborEntry.findMany({
    where: {
      organizationId: orgId,
      startTime: { gte: cutoff },
      ...(schoolIdFilter ? { ticket: { schoolId: { in: schoolIdFilter } } } : {}),
    },
    include: {
      ticket: {
        select: {
          buildingId: true,
          building: { select: { name: true } },
        },
      },
    },
  })

  // Group by month and building
  const monthBuildingMap: Map<string, Map<string, number>> = new Map()

  for (const entry of entries) {
    const month = format(entry.startTime, 'yyyy-MM')
    const buildingName = entry.ticket.building?.name ?? 'No Building'
    const minutes = entry.durationMinutes ?? 0

    if (!monthBuildingMap.has(month)) {
      monthBuildingMap.set(month, new Map())
    }
    const buildingMap = monthBuildingMap.get(month)!
    buildingMap.set(buildingName, (buildingMap.get(buildingName) ?? 0) + minutes)
  }

  const result: LaborHoursByMonthResult[] = []
  const sortedMonths = [...monthBuildingMap.keys()].sort()

  for (const month of sortedMonths) {
    const buildingMap = monthBuildingMap.get(month)!
    const buildings = [...buildingMap.entries()].map(([buildingName, minutes]) => ({
      buildingName,
      hours: Math.round((minutes / 60) * 10) / 10,
    }))
    result.push({ month, buildings })
  }

  return result
}

// ─── ANALYTICS-06: Cost by Building per Month ─────────────────────────────────

export async function getCostByBuilding(
  orgId: string,
  opts: AnalyticsOptions = {}
): Promise<CostByBuildingResult[]> {
  const { months = 6, campusId } = opts
  const cutoff = getCutoff(months)

  let schoolIdFilter: string[] | undefined
  if (campusId) {
    schoolIdFilter = await getSchoolIdsForCampus(campusId)
    if (schoolIdFilter.length === 0) return []
  }

  const ticketFilter = {
    organizationId: orgId,
    deletedAt: null,
    ...(schoolIdFilter ? { schoolId: { in: schoolIdFilter } } : {}),
  }

  // Fetch labor entries with technician rate and building
  const laborEntries = await rawPrisma.maintenanceLaborEntry.findMany({
    where: {
      organizationId: orgId,
      startTime: { gte: cutoff },
      ticket: schoolIdFilter ? { schoolId: { in: schoolIdFilter } } : undefined,
    },
    include: {
      ticket: {
        select: {
          buildingId: true,
          building: { select: { name: true } },
        },
      },
      technician: {
        include: {
          technicianProfile: {
            select: { loadedHourlyRate: true },
          },
        },
      },
    },
  })

  // Fetch material cost entries with building
  const costEntries = await rawPrisma.maintenanceCostEntry.findMany({
    where: {
      organizationId: orgId,
      createdAt: { gte: cutoff },
      ticket: schoolIdFilter
        ? { ...ticketFilter, deletedAt: null, schoolId: { in: schoolIdFilter } }
        : { organizationId: orgId, deletedAt: null },
    },
    include: {
      ticket: {
        select: {
          buildingId: true,
          building: { select: { name: true } },
        },
      },
    },
  })

  // Accumulate: month -> building -> {labor, materials}
  const acc: Map<string, Map<string, { laborCost: number; materialsCost: number }>> = new Map()

  const ensure = (month: string, building: string) => {
    if (!acc.has(month)) acc.set(month, new Map())
    const m = acc.get(month)!
    if (!m.has(building)) m.set(building, { laborCost: 0, materialsCost: 0 })
    return m.get(building)!
  }

  for (const entry of laborEntries) {
    const month = format(entry.startTime, 'yyyy-MM')
    const building = entry.ticket.building?.name ?? 'No Building'
    const rate = entry.technician.technicianProfile?.loadedHourlyRate ?? 0
    const hours = (entry.durationMinutes ?? 0) / 60
    const laborCost = hours * rate
    ensure(month, building).laborCost += laborCost
  }

  for (const entry of costEntries) {
    const month = format(entry.createdAt, 'yyyy-MM')
    const building = entry.ticket.building?.name ?? 'No Building'
    ensure(month, building).materialsCost += entry.amount
  }

  const result: CostByBuildingResult[] = []
  const sortedMonths = [...acc.keys()].sort()

  for (const month of sortedMonths) {
    const buildingMap = acc.get(month)!
    const buildings = [...buildingMap.entries()].map(([buildingName, costs]) => ({
      buildingName,
      laborCost: Math.round(costs.laborCost * 100) / 100,
      materialsCost: Math.round(costs.materialsCost * 100) / 100,
      total: Math.round((costs.laborCost + costs.materialsCost) * 100) / 100,
    }))
    result.push({ month, buildings })
  }

  return result
}

// ─── ANALYTICS-07: Top 10 Ticket Locations ────────────────────────────────────

export async function getTopTicketLocations(
  orgId: string,
  opts: AnalyticsOptions = {}
): Promise<TopLocationResult[]> {
  const { months = 6, campusId } = opts
  const cutoff = getCutoff(months)

  let schoolIdFilter: string[] | undefined
  if (campusId) {
    schoolIdFilter = await getSchoolIdsForCampus(campusId)
    if (schoolIdFilter.length === 0) return []
  }

  const grouped = await rawPrisma.maintenanceTicket.groupBy({
    by: ['buildingId', 'areaId', 'roomId'],
    where: {
      organizationId: orgId,
      deletedAt: null,
      createdAt: { gte: cutoff },
      ...(schoolIdFilter ? { schoolId: { in: schoolIdFilter } } : {}),
    },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  })

  if (grouped.length === 0) return []

  // Batch load names
  const buildingIds = [...new Set(grouped.map((g) => g.buildingId).filter(Boolean) as string[])]
  const areaIds = [...new Set(grouped.map((g) => g.areaId).filter(Boolean) as string[])]
  const roomIds = [...new Set(grouped.map((g) => g.roomId).filter(Boolean) as string[])]

  const [buildings, areas, rooms] = await Promise.all([
    buildingIds.length > 0
      ? rawPrisma.building.findMany({ where: { id: { in: buildingIds } }, select: { id: true, name: true } })
      : [],
    areaIds.length > 0
      ? rawPrisma.area.findMany({ where: { id: { in: areaIds } }, select: { id: true, name: true } })
      : [],
    roomIds.length > 0
      ? rawPrisma.room.findMany({ where: { id: { in: roomIds } }, select: { id: true, roomNumber: true, displayName: true } })
      : [],
  ])

  const buildingMap = new Map(buildings.map((b) => [b.id, b.name]))
  const areaMap = new Map(areas.map((a) => [a.id, a.name]))
  const roomMap = new Map(rooms.map((r) => [r.id, r.displayName || r.roomNumber]))

  return grouped.map((g, i) => {
    const parts = [
      g.buildingId ? buildingMap.get(g.buildingId) : null,
      g.areaId ? areaMap.get(g.areaId) : null,
      g.roomId ? roomMap.get(g.roomId) : null,
    ].filter(Boolean)

    return {
      rank: i + 1,
      locationLabel: parts.length > 0 ? parts.join(' > ') : 'Unknown Location',
      ticketCount: g._count.id,
    }
  })
}

// ─── ANALYTICS-08: Category Breakdown ────────────────────────────────────────

export async function getCategoryBreakdown(
  orgId: string,
  opts: AnalyticsOptions = {}
): Promise<CategoryBreakdownResult[]> {
  const { months = 6, campusId } = opts
  const cutoff = getCutoff(months)

  let schoolIdFilter: string[] | undefined
  if (campusId) {
    schoolIdFilter = await getSchoolIdsForCampus(campusId)
    if (schoolIdFilter.length === 0) return []
  }

  const grouped = await rawPrisma.maintenanceTicket.groupBy({
    by: ['category'],
    where: {
      organizationId: orgId,
      deletedAt: null,
      createdAt: { gte: cutoff },
      ...(schoolIdFilter ? { schoolId: { in: schoolIdFilter } } : {}),
    },
    _count: { id: true },
  })

  const total = grouped.reduce((sum, g) => sum + g._count.id, 0)

  return grouped
    .map((g) => ({
      category: g.category,
      count: g._count.id,
      pct: total > 0 ? Math.round((g._count.id / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count)
}

// ─── Combined: all 8 in parallel ─────────────────────────────────────────────

export async function getAllAnalytics(
  orgId: string,
  opts: AnalyticsOptions = {}
): Promise<AllAnalyticsResult> {
  const [
    ticketsByStatus,
    resolutionTimeByCategory,
    technicianWorkload,
    pmCompliance,
    laborHoursByMonth,
    costByBuilding,
    topLocations,
    categoryBreakdown,
  ] = await Promise.all([
    getTicketsByStatus(orgId, opts),
    getResolutionTimeByCategory(orgId, opts),
    getTechnicianWorkload(orgId, opts),
    getPmComplianceRate(orgId, opts),
    getLaborHoursByMonth(orgId, opts),
    getCostByBuilding(orgId, opts),
    getTopTicketLocations(orgId, opts),
    getCategoryBreakdown(orgId, opts),
  ])

  return {
    ticketsByStatus,
    resolutionTimeByCategory,
    technicianWorkload,
    pmCompliance,
    laborHoursByMonth,
    costByBuilding,
    topLocations,
    categoryBreakdown,
  }
}
