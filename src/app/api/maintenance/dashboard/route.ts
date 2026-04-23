/**
 * GET /api/maintenance/dashboard — aggregate stats for the dashboard
 *
 * Returns: counts by status, priority, category, unassigned count,
 * overdue count (BACKLOG > 48h), average resolution time for DONE tickets.
 * Accepts optional ?schoolId= for campus filtering.
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { getCached, settingsCacheKey } from '@/lib/cache/settings-cache'

// Dashboard data TTL: 60 seconds (frequent enough to feel live, reduces DB load)
const DASHBOARD_CACHE_TTL = 60 * 1000

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const campusId = searchParams.get('campusId') || undefined

  const cacheKey = settingsCacheKey(orgId, `maint-dashboard:${campusId || 'all'}`)
  const stats = await getCached(cacheKey, async () => {
    const baseWhere: Prisma.MaintenanceTicketWhereInput = {}
    if (campusId) baseWhere.campusId = campusId
    const activeWhere: Prisma.MaintenanceTicketWhereInput = { ...baseWhere, status: { notIn: ['DONE', 'CANCELLED'] } }
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000)

    // Run all independent queries in parallel
    const [statusCounts, priorityCounts, categoryCounts, unassignedCount, overdueCount, doneTickets, recentTickets] =
      await Promise.all([
        prisma.maintenanceTicket.groupBy({
          by: ['status'],
          where: baseWhere,
          _count: { id: true },
        }),
        prisma.maintenanceTicket.groupBy({
          by: ['priority'],
          where: activeWhere,
          _count: { id: true },
        }),
        prisma.maintenanceTicket.groupBy({
          by: ['category'],
          where: activeWhere,
          _count: { id: true },
        }),
        prisma.maintenanceTicket.count({
          where: {
            ...baseWhere,
            assignedToId: null,
            status: { notIn: ['DONE', 'CANCELLED', 'SCHEDULED'] },
          },
        }),
        prisma.maintenanceTicket.count({
          where: {
            ...baseWhere,
            status: 'BACKLOG',
            assignedToId: null,
            createdAt: { lt: fortyEightHoursAgo },
          },
        }),
        prisma.maintenanceTicket.findMany({
          where: { ...baseWhere, status: 'DONE' },
          select: { createdAt: true, updatedAt: true },
          take: 100,
          orderBy: { updatedAt: 'desc' },
        }),
        prisma.maintenanceTicket.findMany({
          where: { ...activeWhere },
          orderBy: { updatedAt: 'desc' },
          take: 8,
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            updatedAt: true,
            buildingId: true,
            roomId: true,
            assignedToId: true,
          },
        }),
      ])

    const avgResolutionHours =
      doneTickets.length > 0
        ? doneTickets.reduce((acc, t) => {
            const hours = (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)
            return acc + hours
          }, 0) / doneTickets.length
        : null

    // Campus comparison — only when viewing all campuses
    let byCampus: { campusId: string; campusName: string; count: number }[] = []
    if (!campusId) {
      const campusCounts = await prisma.maintenanceTicket.groupBy({
        by: ['campusId'],
        where: {
          status: { notIn: ['DONE', 'CANCELLED'] },
          campusId: { not: null },
        },
        _count: { id: true },
      })

      if (campusCounts.length > 0) {
        const campusIds = campusCounts
          .map((c) => c.campusId)
          .filter((id): id is string => id !== null)

        const campuses = await prisma.campus.findMany({
          where: { id: { in: campusIds } },
          select: { id: true, name: true },
        })

        const campusMap = new Map(campuses.map((c) => [c.id, c.name]))

        byCampus = campusCounts
          .filter((c) => c.campusId !== null)
          .map((c) => ({
            campusId: c.campusId as string,
            campusName: campusMap.get(c.campusId as string) ?? 'Unknown',
            count: c._count.id,
          }))
          .sort((a, b) => b.count - a.count)
      }
    }

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
      byCampus,
      recentTickets: await (async () => {
        // Batch-resolve building, room, and assignee names for recent tickets
        const buildingIds = [...new Set(recentTickets.map((t) => t.buildingId).filter(Boolean))] as string[]
        const roomIds = [...new Set(recentTickets.map((t) => t.roomId).filter(Boolean))] as string[]
        const assigneeIds = [...new Set(recentTickets.map((t) => t.assignedToId).filter(Boolean))] as string[]

        const [buildings, rooms, assignees] = await Promise.all([
          buildingIds.length > 0
            ? prisma.building.findMany({ where: { id: { in: buildingIds } }, select: { id: true, name: true } })
            : [],
          roomIds.length > 0
            ? prisma.room.findMany({ where: { id: { in: roomIds } }, select: { id: true, roomNumber: true, displayName: true } })
            : [],
          assigneeIds.length > 0
            ? prisma.user.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, name: true } })
            : [],
        ])

        const buildingMap = new Map(buildings.map((b) => [b.id, b.name]))
        const roomMap = new Map(rooms.map((r) => [r.id, r.displayName || r.roomNumber]))
        const assigneeMap = new Map(assignees.map((u) => [u.id, u.name]))

        return recentTickets.map((t) => {
          const parts = [
            t.buildingId ? buildingMap.get(t.buildingId) : null,
            t.roomId ? roomMap.get(t.roomId) : null,
          ].filter(Boolean)
          return {
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            updatedAt: t.updatedAt.toISOString(),
            location: parts.length > 0 ? parts.join(' — ') : null,
            assignedTo: t.assignedToId
              ? { id: t.assignedToId, name: assigneeMap.get(t.assignedToId) ?? 'Unknown' }
              : null,
          }
        })
      })(),
    }
  }, DASHBOARD_CACHE_TTL)

  return NextResponse.json(ok(stats))
}, { permission: PERMISSIONS.MAINTENANCE_READ_ALL })
