/**
 * SLA Service
 *
 * Computes SLA due dates at ticket creation, determines SLA status
 * (OK / AT_RISK / BREACHED), and queries at-risk tickets.
 */

import { rawPrisma } from '@/lib/db'
import type { TicketModule } from '@prisma/client'

// Re-export pure functions and types from client-safe module
export { getSLAStatus, formatTimeLeft } from './sla-utils'
export type { SLAStatus, SLAStatusResult } from './sla-utils'
import { getSLAStatus } from './sla-utils'
import type { SLAStatusResult } from './sla-utils'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SLADueDates {
  slaResponseDue: Date | null
  slaResolveDue: Date | null
}

// ─── Compute SLA Due Dates ───────────────────────────────────────────────────

/**
 * Look up category SLA config and compute due dates from creation time.
 * Returns nulls if no SLA is configured for the category.
 */
export async function computeSLADueDates(
  orgId: string,
  module: TicketModule,
  categoryKey: string,
  createdAt: Date
): Promise<SLADueDates> {
  const config = await rawPrisma.routingCategoryConfig.findUnique({
    where: {
      organizationId_module_categoryKey: {
        organizationId: orgId,
        module,
        categoryKey,
      },
    },
    select: { slaResponseMins: true, slaResolveMins: true },
  })

  if (!config) return { slaResponseDue: null, slaResolveDue: null }

  const slaResponseDue = config.slaResponseMins
    ? new Date(createdAt.getTime() + config.slaResponseMins * 60_000)
    : null

  const slaResolveDue = config.slaResolveMins
    ? new Date(createdAt.getTime() + config.slaResolveMins * 60_000)
    : null

  return { slaResponseDue, slaResolveDue }
}

// ─── At-Risk Tickets Query ───────────────────────────────────────────────────

export interface AtRiskTicket {
  id: string
  ticketNumber: string
  title: string
  module: string
  status: string
  priority: string
  category: string
  assignedTo: { firstName: string | null; lastName: string | null } | null
  slaResponseDue: Date | null
  slaResolveDue: Date | null
  firstResponseAt: Date | null
  createdAt: Date
  slaStatus: SLAStatusResult
}

/**
 * Get tickets that are at-risk or breached for SLA.
 */
export async function getAtRiskTickets(
  orgId: string,
  module: TicketModule,
  limit: number = 10
): Promise<AtRiskTicket[]> {
  const now = new Date()

  // Query tickets with SLA due dates that haven't been resolved
  const baseWhere = {
    organizationId: orgId,
    deletedAt: null,
    status: { notIn: ['DONE', 'CANCELLED'] },
    OR: [
      { slaResponseDue: { not: null } },
      { slaResolveDue: { not: null } },
    ],
  }

  const assigneeSelect = {
    select: { firstName: true, lastName: true } as const,
  }

  let tickets: AtRiskTicket[]

  if (module === 'MAINTENANCE') {
    const raw = await rawPrisma.maintenanceTicket.findMany({
      where: baseWhere as any,
      select: {
        id: true, ticketNumber: true, title: true, status: true, priority: true, category: true,
        assignedTo: assigneeSelect,
        slaResponseDue: true, slaResolveDue: true, firstResponseAt: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 50, // fetch more than limit to filter
    })

    tickets = raw.map((t) => ({
      ...t,
      module: 'MAINTENANCE',
      slaStatus: getSLAStatus(t),
    }))
  } else {
    const raw = await rawPrisma.iTTicket.findMany({
      where: baseWhere as any,
      select: {
        id: true, ticketNumber: true, title: true, status: true, priority: true,
        issueType: true,
        assignedTo: assigneeSelect,
        slaResponseDue: true, slaResolveDue: true, firstResponseAt: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    })

    tickets = raw.map((t) => ({
      ...t,
      module: 'IT',
      category: t.issueType,
      slaStatus: getSLAStatus(t),
    }))
  }

  // Filter to only at-risk or breached, sort by urgency
  return tickets
    .filter((t) =>
      t.slaStatus.responseStatus === 'AT_RISK' ||
      t.slaStatus.responseStatus === 'BREACHED' ||
      t.slaStatus.resolveStatus === 'AT_RISK' ||
      t.slaStatus.resolveStatus === 'BREACHED'
    )
    .sort((a, b) => {
      // Breached first, then at-risk, then by time left
      const scoreA = (a.slaStatus.responseStatus === 'BREACHED' || a.slaStatus.resolveStatus === 'BREACHED') ? 0 : 1
      const scoreB = (b.slaStatus.responseStatus === 'BREACHED' || b.slaStatus.resolveStatus === 'BREACHED') ? 0 : 1
      if (scoreA !== scoreB) return scoreA - scoreB
      // Closest to breach first
      const timeA = Math.min(a.slaStatus.responseTimeLeft ?? Infinity, a.slaStatus.resolveTimeLeft ?? Infinity)
      const timeB = Math.min(b.slaStatus.responseTimeLeft ?? Infinity, b.slaStatus.resolveTimeLeft ?? Infinity)
      return timeA - timeB
    })
    .slice(0, limit)
}
