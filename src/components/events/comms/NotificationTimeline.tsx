'use client'

/**
 * NotificationTimeline
 *
 * Gantt-lite horizontal timeline showing notification rules as pins relative to
 * the event date. Timeline spans 30 days before → 7 days after the event.
 *
 * Features:
 * - Event day marked with bold vertical line + aurora gradient label
 * - Day markers along x-axis (every 7 days labeled, individual day ticks)
 * - Notification pins colored by status, with hover tooltips
 * - Action-triggered rules in a separate "Triggered" lane below
 * - Horizontally scrollable if content overflows viewport
 * - Framer Motion fadeInUp entrance animation
 */

import { useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Bell, Plus, Zap } from 'lucide-react'
import { fadeInUp, EASE_OUT_CUBIC } from '@/lib/animations'
import { useNotificationRules } from '@/lib/hooks/useNotificationRules'
import { NotificationTimelinePin } from './NotificationTimelinePin'
import type { NotificationRuleRow } from '@/lib/types/notification-orchestration'

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS_BEFORE = 30
const DAYS_AFTER = 7
const TOTAL_DAYS = DAYS_BEFORE + DAYS_AFTER
const PIXELS_PER_DAY = 36
const TIMELINE_WIDTH = TOTAL_DAYS * PIXELS_PER_DAY
const LABEL_INTERVAL = 7 // label every 7 days
const PIN_AREA_HEIGHT = 96 // px for pin + label area above the rail

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotificationTimelineProps {
  eventProjectId: string
  eventTitle: string
  eventStartDate: Date
  onAddRule: () => void
  onEditRule: (rule: NotificationRuleRow) => void
}

// ─── Day axis label helper ────────────────────────────────────────────────────

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-48 mb-4" />
      <div className="h-24 bg-gray-100 rounded-xl" />
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-10 px-4 rounded-xl text-center"
      style={{
        background: 'linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(99,102,241,0.06) 100%)',
        border: '1.5px dashed rgba(99,102,241,0.25)',
      }}
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
        style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.15))' }}
      >
        <Bell className="w-6 h-6 text-indigo-500" />
      </div>
      <h4 className="text-sm font-semibold text-gray-800 mb-1">
        No notification rules yet
      </h4>
      <p className="text-xs text-gray-500 max-w-xs mb-4">
        Add notification triggers to automatically remind participants at the right moment before, during, or after your event.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Notification
      </button>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function NotificationTimeline({
  eventProjectId,
  eventTitle,
  eventStartDate,
  onAddRule,
  onEditRule,
}: NotificationTimelineProps) {
  const { data: rules = [], isLoading } = useNotificationRules(eventProjectId)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [_hoveredRule, setHoveredRule] = useState<string | null>(null)

  // Compute timeline bounds
  const timelineStartDate = new Date(eventStartDate)
  timelineStartDate.setDate(timelineStartDate.getDate() - DAYS_BEFORE)

  const timelineEndDate = new Date(eventStartDate)
  timelineEndDate.setDate(timelineEndDate.getDate() + DAYS_AFTER)

  // Event day position
  const eventDayOffsetPx = DAYS_BEFORE * PIXELS_PER_DAY

  // Separate rules by trigger type
  const scheduledRules = rules.filter((r) => r.triggerType !== 'ACTION_TRIGGERED')
  const actionRules = rules.filter((r) => r.triggerType === 'ACTION_TRIGGERED')

  const handlePinClick = useCallback((rule: NotificationRuleRow) => {
    onEditRule(rule)
  }, [onEditRule])

  if (isLoading) return <TimelineSkeleton />

  if (rules.length === 0) {
    return <EmptyState onAdd={onAddRule} />
  }

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      transition={{ duration: 0.3, ease: EASE_OUT_CUBIC }}
      className="space-y-4"
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {rules.length} notification rule{rules.length !== 1 ? 's' : ''}
        </p>
        <button
          type="button"
          onClick={onAddRule}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 active:scale-[0.97] transition-all cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          Add Notification
        </button>
      </div>

      {/* Scrollable timeline container */}
      <div
        ref={scrollRef}
        className="overflow-x-auto pb-2 rounded-xl bg-gray-50 border border-gray-200"
      >
        <div style={{ width: TIMELINE_WIDTH, minWidth: '100%', position: 'relative' }}>

          {/* ── Pin area (above rail) ── */}
          <div style={{ height: PIN_AREA_HEIGHT, position: 'relative' }}>
            {scheduledRules.map((rule) => (
              <NotificationTimelinePin
                key={rule.id}
                rule={rule}
                eventStartDate={eventStartDate}
                timelineStartDate={timelineStartDate}
                timelineEndDate={timelineEndDate}
                pixelsPerDay={PIXELS_PER_DAY}
                onClick={() => handlePinClick(rule)}
              />
            ))}
          </div>

          {/* ── Timeline rail ── */}
          <div style={{ position: 'relative', height: 40 }}>
            {/* Background rail */}
            <div
              className="absolute top-1/2 left-0 right-0 h-px bg-gray-200"
              style={{ transform: 'translateY(-50%)' }}
            />

            {/* Day ticks and labels */}
            {Array.from({ length: TOTAL_DAYS + 1 }, (_, i) => {
              const tickDate = new Date(timelineStartDate)
              tickDate.setDate(tickDate.getDate() + i)
              const leftPx = i * PIXELS_PER_DAY
              const showLabel = i % LABEL_INTERVAL === 0
              const isEventDay = i === DAYS_BEFORE

              if (isEventDay) return null // rendered separately below

              return (
                <div
                  key={i}
                  className="absolute flex flex-col items-center"
                  style={{ left: leftPx, top: 0, bottom: 0 }}
                >
                  <div
                    className={`w-px ${showLabel ? 'bg-gray-300 h-3' : 'bg-gray-200 h-2'}`}
                    style={{ marginTop: showLabel ? 14 : 18 }}
                  />
                  {showLabel && (
                    <span className="text-[9px] text-gray-400 mt-0.5 whitespace-nowrap">
                      {formatDayLabel(tickDate)}
                    </span>
                  )}
                </div>
              )
            })}

            {/* Event day marker — bold vertical line with aurora gradient label */}
            <div
              className="absolute top-0 bottom-0 flex flex-col items-center"
              style={{ left: eventDayOffsetPx }}
            >
              {/* Bold vertical line */}
              <div
                className="w-0.5 h-full"
                style={{
                  background: 'linear-gradient(180deg, #3B82F6 0%, #6366F1 100%)',
                }}
              />
              {/* Label */}
              <div
                className="absolute text-[9px] font-bold whitespace-nowrap px-1.5 py-0.5 rounded"
                style={{
                  top: 24,
                  background: 'linear-gradient(90deg, #3B82F6 0%, #6366F1 100%)',
                  color: '#fff',
                  transform: 'translateX(-50%)',
                }}
              >
                Event Day
              </div>
            </div>
          </div>

          {/* ── x-axis date labels ── */}
          <div className="relative px-2 pb-2 pt-1">
            <div className="flex justify-between text-[9px] text-gray-400">
              <span>{formatDayLabel(timelineStartDate)}</span>
              <span>{formatDayLabel(timelineEndDate)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Action-triggered rules lane ── */}
      {actionRules.length > 0 && (
        <div className="border border-gray-200 rounded-xl bg-gray-50 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200 bg-white">
            <Zap className="w-3.5 h-3.5 text-violet-500" />
            <span className="text-xs font-medium text-gray-600">Action-triggered</span>
            <span className="text-xs text-gray-400 ml-auto">(no fixed date — fires on event)</span>
          </div>
          <div className="divide-y divide-gray-100">
            {actionRules.map((rule) => (
              <button
                key={rule.id}
                type="button"
                onClick={() => handlePinClick(rule)}
                onMouseEnter={() => setHoveredRule(rule.id)}
                onMouseLeave={() => setHoveredRule(null)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 transition-colors cursor-pointer text-left"
              >
                <Zap className="w-4 h-4 text-violet-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{rule.label}</p>
                  <p className="text-xs text-gray-500">{rule.actionType ?? 'Action'}</p>
                </div>
                <StatusBadge status={rule.status} />
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: NotificationRuleRow['status'] }) {
  const styles: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-600',
    PENDING_APPROVAL: 'bg-amber-100 text-amber-700',
    APPROVED: 'bg-blue-100 text-blue-700',
    SENT: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-500',
  }
  const labels: Record<string, string> = {
    DRAFT: 'Draft',
    PENDING_APPROVAL: 'Pending',
    APPROVED: 'Approved',
    SENT: 'Sent',
    CANCELLED: 'Cancelled',
  }
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {labels[status] ?? status}
    </span>
  )
}
