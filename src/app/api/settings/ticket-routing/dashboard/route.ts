import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
// eslint-disable-next-line no-restricted-imports -- Ticket-routing dashboard reads aggregate helper records with explicit orgId filters after withAuth.
import { rawPrisma } from '@/lib/db'
import { getAtRiskTickets } from '@/lib/services/slaService'
import type { TicketModule } from '@prisma/client'

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const moduleParam = searchParams.get('module') as TicketModule | null
  if (!moduleParam || !['MAINTENANCE', 'IT'].includes(moduleParam)) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'moduleParam query param required'),
      { status: 400 }
    )
  }

  // At-risk tickets
  const atRiskTickets = await getAtRiskTickets(orgId, moduleParam, 5)

  const breachedCount = atRiskTickets.filter(
    (t) => t.slaStatus.responseStatus === 'BREACHED' || t.slaStatus.resolveStatus === 'BREACHED'
  ).length
  const atRiskCount = atRiskTickets.length - breachedCount

  // Staff workload
  const staffAvailabilities = await rawPrisma.staffAvailability.findMany({
    where: { organizationId: orgId, module: moduleParam },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
    },
  })

  const workload = await Promise.all(
    staffAvailabilities.map(async (sa) => {
      const openTickets = moduleParam === 'MAINTENANCE'
        ? await rawPrisma.maintenanceTicket.count({
            where: {
              organizationId: orgId,
              assignedToId: sa.userId,
              status: { notIn: ['DONE', 'CANCELLED'] },
              deletedAt: null,
            },
          })
        : await rawPrisma.iTTicket.count({
            where: {
              organizationId: orgId,
              assignedToId: sa.userId,
              status: { notIn: ['DONE', 'CANCELLED'] },
              deletedAt: null,
            },
          })

      return {
        userId: sa.userId,
        name: `${sa.user.firstName ?? ''} ${sa.user.lastName ?? ''}`.trim(),
        openTickets,
        maxActiveTickets: sa.maxActiveTickets,
        status: sa.status,
        utilizationPct: Math.round((openTickets / sa.maxActiveTickets) * 100),
      }
    })
  )

  // Category distribution
  let categoryDistribution: Array<{ category: string; count: number }>
  if (moduleParam === 'MAINTENANCE') {
    const raw = await rawPrisma.maintenanceTicket.groupBy({
      by: ['category'],
      where: {
        organizationId: orgId,
        status: { notIn: ['DONE', 'CANCELLED'] },
        deletedAt: null,
      },
      _count: true,
    })
    categoryDistribution = raw.map((r) => ({ category: r.category, count: r._count }))
  } else {
    const raw = await rawPrisma.iTTicket.groupBy({
      by: ['issueType'],
      where: {
        organizationId: orgId,
        status: { notIn: ['DONE', 'CANCELLED'] },
        deletedAt: null,
      },
      _count: true,
    })
    categoryDistribution = raw.map((r) => ({ category: r.issueType, count: r._count }))
  }

  return NextResponse.json(ok({
    sla: {
      atRiskCount,
      breachedCount,
      tickets: atRiskTickets,
    },
    workload,
    categoryDistribution,
  }))
}, { permission: PERMISSIONS.SETTINGS_READ })
