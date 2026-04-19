'use client'

import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { getSLAStatus, formatTimeLeft, type SLAStatus } from '@/lib/services/sla-utils'

interface SLABadgeProps {
  ticket: {
    createdAt: string | Date
    firstResponseAt?: string | Date | null
    slaResponseDue?: string | Date | null
    slaResolveDue?: string | Date | null
    status?: string
  }
  /** Which SLA to show — defaults to worst of response/resolve */
  type?: 'response' | 'resolve' | 'worst'
}

export default function SLABadge({ ticket, type = 'worst' }: SLABadgeProps) {
  // No SLA configured
  if (!ticket.slaResponseDue && !ticket.slaResolveDue) return null

  const status = getSLAStatus(ticket)

  let displayStatus: SLAStatus
  let timeLeft: number | null

  if (type === 'response') {
    displayStatus = status.responseStatus
    timeLeft = status.responseTimeLeft
  } else if (type === 'resolve') {
    displayStatus = status.resolveStatus
    timeLeft = status.resolveTimeLeft
  } else {
    // Worst of the two
    const priority: Record<SLAStatus, number> = { BREACHED: 0, AT_RISK: 1, OK: 2, MET: 3 }
    if (priority[status.responseStatus] <= priority[status.resolveStatus]) {
      displayStatus = status.responseStatus
      timeLeft = status.responseTimeLeft
    } else {
      displayStatus = status.resolveStatus
      timeLeft = status.resolveTimeLeft
    }
  }

  if (displayStatus === 'OK' || displayStatus === 'MET') return null

  if (displayStatus === 'BREACHED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <AlertTriangle className="w-3 h-3" />
        SLA breached {formatTimeLeft(timeLeft)}
      </span>
    )
  }

  // AT_RISK
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
      <Clock className="w-3 h-3" />
      SLA: {formatTimeLeft(timeLeft)} left
    </span>
  )
}
