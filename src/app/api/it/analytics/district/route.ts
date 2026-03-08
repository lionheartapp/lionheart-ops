import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { runWithOrgContext } from '@/lib/org-context'
import { getAllITAnalytics } from '@/lib/services/itAnalyticsService'
import { rawPrisma } from '@/lib/db'

// Simple in-memory cache
let cache: { key: string; data: unknown; ts: number } | null = null
const CACHE_TTL = 2 * 60 * 1000 // 2 minutes

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_ANALYTICS_READ)

    const cacheKey = `district:${orgId}`

    if (cache && cache.key === cacheKey && Date.now() - cache.ts < CACHE_TTL) {
      return NextResponse.json(ok(cache.data))
    }

    return await runWithOrgContext(orgId, async () => {
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
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Failed to fetch district IT analytics:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
