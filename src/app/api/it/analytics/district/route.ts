import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getAllITAnalytics } from '@/lib/services/itAnalyticsService'
import { rawPrisma } from '@/lib/db'

// Simple in-memory cache
let cache: { key: string; data: unknown; ts: number } | null = null
const CACHE_TTL = 2 * 60 * 1000 // 2 minutes

export const GET = withAuth(async ({ orgId }) => {
  const cacheKey = `district:${orgId}`

  if (cache && cache.key === cacheKey && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(ok(cache.data))
  }

  // Get all schools for per-campus breakdown
  const schools = await rawPrisma.school.findMany({
    where: { organizationId: orgId, deletedAt: null },
    select: { id: true, name: true },
  })

  // Get district-wide analytics (no school filter)
  const districtAnalytics = await getAllITAnalytics(orgId, { months: 12 })

  // Get per-campus analytics for comparison
  const perCampus = await Promise.all(
    schools.map(async (school) => {
      const analytics = await getAllITAnalytics(orgId, { schoolId: school.id, months: 12 })
      return {
        schoolId: school.id,
        schoolName: school.name,
        ticketCount: analytics.ticketVolume.reduce((sum, t) => sum + t.count, 0),
        avgResolutionHours: analytics.resolutionTime.length > 0
          ? analytics.resolutionTime.reduce((sum, r) => sum + r.avgHours, 0) / analytics.resolutionTime.length
          : 0,
        deviceCount: analytics.deviceHealth.reduce((sum, d) => sum + d.good + d.fair + d.poor + d.retired, 0),
        slaCompliancePct: analytics.slaCompliance.length > 0
          ? analytics.slaCompliance.reduce((sum, s) => sum + s.compliancePct, 0) / analytics.slaCompliance.length
          : 100,
        loanerUtilizationPct: analytics.loanerUtilization.utilizationPct,
      }
    })
  )

  // Find highest-volume buildings
  const ticketsByBuilding = await rawPrisma.iTTicket.groupBy({
    by: ['buildingId'],
    where: { organizationId: orgId, deletedAt: null, buildingId: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  })

  const buildingIds = ticketsByBuilding.map((t) => t.buildingId!).filter(Boolean)
  const buildings = buildingIds.length > 0
    ? await rawPrisma.building.findMany({
        where: { id: { in: buildingIds } },
        select: { id: true, name: true },
      })
    : []
  const buildingMap = new Map(buildings.map((b) => [b.id, b.name]))

  const highVolumeBuildings = ticketsByBuilding
    .filter((t) => t.buildingId)
    .map((t) => ({
      buildingId: t.buildingId!,
      buildingName: buildingMap.get(t.buildingId!) ?? 'Unknown',
      ticketCount: t._count.id,
    }))

  const result = {
    ...districtAnalytics,
    perCampus,
    highVolumeBuildings,
  }

  cache = { key: cacheKey, data: result, ts: Date.now() }
  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.IT_ANALYTICS_READ })
