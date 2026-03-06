/**
 * GET /api/maintenance/dashboard — aggregate stats for the dashboard
 *
 * Returns: counts by status, priority, category, unassigned count,
 * overdue count (BACKLOG > 48h), average resolution time for DONE tickets.
 * Accepts optional ?schoolId= for campus filtering.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { runWithOrgContext } from '@/lib/org-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.MAINTENANCE_READ_ALL)

    const url = new URL(req.url)
    const schoolId = url.searchParams.get('schoolId') || undefined

    const stats = await runWithOrgContext(orgId, async () => {
      const baseWhere: Record<string, unknown> = {}
      if (schoolId) baseWhere.schoolId = schoolId

      // Count by status
      const statusCounts = await prisma.maintenanceTicket.groupBy({
        by: ['status'],
        where: baseWhere as any,
        _count: { id: true },
      })

      // Count by priority
      const priorityCounts = await prisma.maintenanceTicket.groupBy({
        by: ['priority'],
        where: {
          ...baseWhere,
          status: { notIn: ['DONE', 'CANCELLED'] },
        } as any,
        _count: { id: true },
      })

      // Count by category (active tickets only)
      const categoryCounts = await prisma.maintenanceTicket.groupBy({
        by: ['category'],
        where: {
          ...baseWhere,
          status: { notIn: ['DONE', 'CANCELLED'] },
        } as any,
        _count: { id: true },
      })

      // Unassigned count (active)
      const unassignedCount = await prisma.maintenanceTicket.count({
        where: {
          ...baseWhere,
          assignedToId: null,
          status: { notIn: ['DONE', 'CANCELLED', 'SCHEDULED'] },
        } as any,
      })

      // Overdue: BACKLOG tickets older than 48h with no assignment
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000)
      const overdueCount = await prisma.maintenanceTicket.count({
        where: {
          ...baseWhere,
          status: 'BACKLOG',
          assignedToId: null,
          createdAt: { lt: fortyEightHoursAgo },
        } as any,
      })

      // Average resolution time for DONE tickets (updatedAt - createdAt in hours)
      const doneTickets = await prisma.maintenanceTicket.findMany({
        where: {
          ...baseWhere,
          status: 'DONE',
        } as any,
        select: { createdAt: true, updatedAt: true },
        take: 100, // Cap to last 100 for performance
        orderBy: { updatedAt: 'desc' },
      })

      const avgResolutionHours =
        doneTickets.length > 0
          ? doneTickets.reduce((acc, t) => {
              const hours = (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)
              return acc + hours
            }, 0) / doneTickets.length
          : null

      return {
        byStatus: Object.fromEntries(
          statusCounts.map((s) => [s.status, s._count.id])
        ),
        byPriority: Object.fromEntries(
          priorityCounts.map((p) => [p.priority, p._count.id])
        ),
        byCategory: Object.fromEntries(
          categoryCounts.map((c) => [c.category, c._count.id])
        ),
        unassignedCount,
        overdueCount,
        avgResolutionHours: avgResolutionHours !== null
          ? Math.round(avgResolutionHours * 10) / 10
          : null,
      }
    })

    return NextResponse.json(ok(stats))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/maintenance/dashboard]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
