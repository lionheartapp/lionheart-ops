/**
 * SLA pure utility functions — safe for client-side import.
 * No database or server-only dependencies.
 */

export type SLAStatus = 'OK' | 'AT_RISK' | 'BREACHED' | 'MET'

export interface SLAStatusResult {
  responseStatus: SLAStatus
  resolveStatus: SLAStatus
  responseTimeLeft: number | null   // minutes remaining (negative = overdue)
  resolveTimeLeft: number | null
}

interface TicketForSLA {
  createdAt: Date | string
  firstResponseAt?: Date | string | null
  slaResponseDue?: Date | string | null
  slaResolveDue?: Date | string | null
  status?: string
}

// Terminal statuses — SLA doesn't apply
const TERMINAL_STATUSES = new Set(['DONE', 'CANCELLED'])

// AT_RISK threshold: 75% of SLA window elapsed
const AT_RISK_THRESHOLD = 0.75

/**
 * Determine SLA status for a ticket based on current time vs due dates.
 */
export function getSLAStatus(ticket: TicketForSLA): SLAStatusResult {
  const now = new Date()
  const createdAt = new Date(ticket.createdAt)

  // Response SLA
  let responseStatus: SLAStatus = 'OK'
  let responseTimeLeft: number | null = null

  if (ticket.slaResponseDue) {
    const due = new Date(ticket.slaResponseDue)
    const hasResponded = !!ticket.firstResponseAt

    if (hasResponded) {
      const respondedAt = new Date(ticket.firstResponseAt!)
      responseStatus = respondedAt <= due ? 'MET' : 'BREACHED'
    } else if (TERMINAL_STATUSES.has(ticket.status ?? '')) {
      responseStatus = 'MET'
    } else {
      responseTimeLeft = (due.getTime() - now.getTime()) / 60_000
      const totalWindow = (due.getTime() - createdAt.getTime()) / 60_000
      const elapsed = totalWindow - responseTimeLeft

      if (responseTimeLeft <= 0) {
        responseStatus = 'BREACHED'
      } else if (totalWindow > 0 && elapsed / totalWindow >= AT_RISK_THRESHOLD) {
        responseStatus = 'AT_RISK'
      }
    }
  }

  // Resolution SLA
  let resolveStatus: SLAStatus = 'OK'
  let resolveTimeLeft: number | null = null

  if (ticket.slaResolveDue) {
    const due = new Date(ticket.slaResolveDue)

    if (TERMINAL_STATUSES.has(ticket.status ?? '')) {
      resolveStatus = 'MET'
    } else {
      resolveTimeLeft = (due.getTime() - now.getTime()) / 60_000
      const totalWindow = (due.getTime() - createdAt.getTime()) / 60_000
      const elapsed = totalWindow - resolveTimeLeft

      if (resolveTimeLeft <= 0) {
        resolveStatus = 'BREACHED'
      } else if (totalWindow > 0 && elapsed / totalWindow >= AT_RISK_THRESHOLD) {
        resolveStatus = 'AT_RISK'
      }
    }
  }

  return { responseStatus, resolveStatus, responseTimeLeft, resolveTimeLeft }
}

/**
 * Format minutes remaining as human-readable string.
 */
export function formatTimeLeft(minutes: number | null): string {
  if (minutes === null) return ''
  const abs = Math.abs(minutes)
  const prefix = minutes < 0 ? 'overdue ' : ''
  if (abs < 60) return `${prefix}${Math.round(abs)}m`
  if (abs < 1440) return `${prefix}${Math.round(abs / 60)}h`
  return `${prefix}${Math.round(abs / 1440)}d`
}
