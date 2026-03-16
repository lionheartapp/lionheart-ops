'use client'

/**
 * NotificationTimelinePin
 *
 * Renders a single pin (vertical marker) on the Notification Timeline.
 * Pin appearance varies by rule status and trigger type.
 * Clickable to open the edit drawer.
 */

import { useRef, useState } from 'react'
import { Clock, Filter, Zap, CheckCircle } from 'lucide-react'
import type { NotificationRuleRow } from '@/lib/types/notification-orchestration'

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotificationTimelinePinProps {
  rule: NotificationRuleRow
  eventStartDate: Date
  timelineStartDate: Date
  timelineEndDate: Date
  pixelsPerDay: number
  onClick: () => void
}

// ─── Status style config ──────────────────────────────────────────────────────

const STATUS_STYLES = {
  DRAFT: {
    dotClass: 'bg-gray-400',
    borderClass: 'border-gray-300 border-dashed',
    labelClass: 'text-gray-500',
    lineClass: 'bg-gray-300',
  },
  PENDING_APPROVAL: {
    dotClass: 'bg-amber-500 animate-pulse',
    borderClass: 'border-amber-400 border-solid',
    labelClass: 'text-amber-700',
    lineClass: 'bg-amber-400',
  },
  APPROVED: {
    dotClass: 'bg-blue-500',
    borderClass: 'border-blue-400 border-solid',
    labelClass: 'text-blue-700',
    lineClass: 'bg-blue-400',
  },
  SENT: {
    dotClass: 'bg-green-500',
    borderClass: 'border-green-400 border-solid',
    labelClass: 'text-green-700',
    lineClass: 'bg-green-400',
  },
  CANCELLED: {
    dotClass: 'bg-red-400',
    borderClass: 'border-red-300 border-dashed',
    labelClass: 'text-red-400 line-through',
    lineClass: 'bg-red-300',
  },
} as const

// ─── Trigger type icon ────────────────────────────────────────────────────────

function TriggerIcon({ type, className }: { type: NotificationRuleRow['triggerType']; className?: string }) {
  const iconClass = `w-3 h-3 ${className ?? ''}`
  if (type === 'DATE_BASED') return <Clock className={iconClass} />
  if (type === 'CONDITION_BASED') return <Filter className={iconClass} />
  return <Zap className={iconClass} />
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatScheduledDate(date: Date | string | null): string {
  if (!date) return 'Unscheduled'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getTriggerLabel(rule: NotificationRuleRow): string {
  if (rule.triggerType === 'DATE_BASED') {
    const days = rule.offsetDays ?? 0
    if (days === 0) return 'Day of event'
    return days > 0 ? `${days}d after` : `${Math.abs(days)}d before`
  }
  if (rule.triggerType === 'CONDITION_BASED') {
    return rule.conditionType ?? 'Condition'
  }
  return rule.actionType ?? 'Action'
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipProps {
  rule: NotificationRuleRow
  visible: boolean
}

function PinTooltip({ rule, visible }: TooltipProps) {
  if (!visible) return null

  const statusLabel: Record<string, string> = {
    DRAFT: 'Draft',
    PENDING_APPROVAL: 'Pending Approval',
    APPROVED: 'Approved — queued',
    SENT: 'Sent',
    CANCELLED: 'Cancelled',
  }

  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 pointer-events-none">
      <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg max-w-[200px]">
        <p className="font-medium truncate">{rule.label}</p>
        <p className="text-gray-300 mt-0.5">{getTriggerLabel(rule)}</p>
        {rule.scheduledAt && (
          <p className="text-gray-400 mt-0.5">{formatScheduledDate(rule.scheduledAt)}</p>
        )}
        <p className="text-gray-400 mt-0.5">{statusLabel[rule.status] ?? rule.status}</p>
        {/* Tooltip arrow */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NotificationTimelinePin({
  rule,
  eventStartDate,
  timelineStartDate,
  pixelsPerDay,
  onClick,
}: NotificationTimelinePinProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const pinRef = useRef<HTMLDivElement>(null)

  const styles = STATUS_STYLES[rule.status]

  // Calculate horizontal position from timelineStartDate
  let anchorDate: Date
  if (rule.triggerType === 'DATE_BASED' && rule.scheduledAt) {
    anchorDate = new Date(rule.scheduledAt)
  } else if (rule.triggerType === 'CONDITION_BASED' && rule.conditionThresholdDays != null) {
    const ms = eventStartDate.getTime() - rule.conditionThresholdDays * 86_400_000
    anchorDate = new Date(ms)
  } else {
    // Fallback: position at event start for unresolved dates
    anchorDate = new Date(eventStartDate)
  }

  const daysFromStart =
    (anchorDate.getTime() - timelineStartDate.getTime()) / 86_400_000
  const leftPx = Math.max(0, daysFromStart * pixelsPerDay)

  return (
    <div
      ref={pinRef}
      className="absolute top-0 flex flex-col items-center cursor-pointer group"
      style={{ left: leftPx, transform: 'translateX(-50%)' }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Notification: ${rule.label}`}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      {/* Tooltip */}
      <div className="relative">
        <PinTooltip rule={rule} visible={showTooltip} />
      </div>

      {/* Pin head */}
      <div
        className={`
          flex items-center justify-center
          w-7 h-7 rounded-full border-2
          bg-white shadow-sm
          transition-transform duration-150 group-hover:scale-110
          ${styles.borderClass}
        `}
      >
        {rule.status === 'SENT' ? (
          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
        ) : (
          <TriggerIcon type={rule.triggerType} className={styles.labelClass} />
        )}
      </div>

      {/* Vertical line down to timeline rail */}
      <div className={`w-px h-4 ${styles.lineClass}`} />

      {/* Status dot */}
      <div className={`w-2 h-2 rounded-full ${styles.dotClass}`} />

      {/* Label below pin */}
      <div className="mt-1.5 max-w-[80px] text-center">
        <span
          className={`text-[10px] font-medium leading-tight block truncate ${styles.labelClass}`}
          title={rule.label}
        >
          {rule.label}
        </span>
      </div>
    </div>
  )
}
