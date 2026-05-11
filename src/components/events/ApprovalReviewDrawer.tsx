'use client'

/**
 * ApprovalReviewDrawer
 *
 * Safer approval flow — replaces the previous one-click "Approve" button
 * that lived in the top-right of every event detail tab. Opens as a
 * confirmation drawer showing the full event context (title, date, location,
 * description, current gate status) so the approver can't blindly confirm
 * an event from a Budget tab scroll.
 *
 * Primary action: Approve (requires a deliberate second click in the drawer).
 * Secondary: Cancel (closes drawer without committing).
 *
 * Per-gate Approve/Reject + reject-with-reason is a future scope — for now
 * this is a pure confirmation layer on top of the existing approve mutation.
 */

import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { X, CheckCircle2, Loader2, MapPin, Calendar as CalendarIcon, User } from 'lucide-react'
import { ApprovalGatesBar, type ApprovalGates } from './overview/ApprovalGatesBar'
import ApprovalTimeline from './overview/ApprovalTimeline'
import {
  SURFACE,
  BORDER,
  HAIRLINE,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  WARM_CHIP,
  CARD_SHADOW,
} from '@/lib/design/warm-tokens'

/**
 * Project shape accepted by the drawer. Intentionally loose to accept the
 * full EventProject from the detail page without coupling to its exact shape.
 * ApprovalGates is cast at render time because EventProject types gate.status
 * as `string` while ApprovalGatesBar expects a string-literal union.
 */
interface DrawerProject {
  title: string
  description?: string | null
  startsAt: string | Date
  endsAt: string | Date
  isMultiDay?: boolean
  locationText?: string | null
  createdBy?: { firstName?: string | null; lastName?: string | null; email?: string | null } | null
  approvalGates?: unknown
}

interface ApprovalReviewDrawerProps {
  isOpen: boolean
  onClose: () => void
  onApprove: () => void
  isApproving: boolean
  project: DrawerProject
}

export function ApprovalReviewDrawer({
  isOpen,
  onClose,
  onApprove,
  isApproving,
  project,
}: ApprovalReviewDrawerProps) {
  const startsAt = project.startsAt instanceof Date ? project.startsAt : new Date(project.startsAt)
  const endsAt = project.endsAt instanceof Date ? project.endsAt : new Date(project.endsAt)

  const dateDisplay = project.isMultiDay
    ? `${format(startsAt, 'MMM d')} – ${format(endsAt, 'MMM d, yyyy')}`
    : `${format(startsAt, 'EEEE, MMMM d, yyyy')}`

  const timeDisplay = !project.isMultiDay
    ? `${format(startsAt, 'h:mm a')} – ${format(endsAt, 'h:mm a')}`
    : null

  const creatorName = project.createdBy?.firstName
    ? `${project.createdBy.firstName} ${project.createdBy.lastName || ''}`.trim()
    : project.createdBy?.email || 'Unknown'

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40"
            style={{ backgroundColor: 'rgba(17, 15, 10, 0.3)' }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:right-4 sm:top-4 sm:bottom-4 sm:max-w-md z-50 flex flex-col overflow-hidden sm:rounded-2xl"
            style={{
              backgroundColor: SURFACE,
              border: `1px solid ${BORDER}`,
              boxShadow: CARD_SHADOW,
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-5 flex-shrink-0"
              style={{ borderBottom: `1px solid ${HAIRLINE}` }}
            >
              <h2
                className="text-[17px] font-semibold"
                style={{ color: TEXT_PRIMARY, letterSpacing: '-0.015em' }}
              >
                Review Approval
              </h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer"
                style={{ color: TEXT_SECONDARY }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = WARM_CHIP)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                aria-label="Close drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Event summary */}
              <div>
                <p
                  className="text-[10.5px] font-semibold uppercase tracking-[0.1em] mb-2"
                  style={{ color: TEXT_MUTED }}
                >
                  Event
                </p>
                <h3
                  className="text-[20px] font-semibold leading-tight"
                  style={{ color: TEXT_PRIMARY, letterSpacing: '-0.02em' }}
                >
                  {project.title}
                </h3>
                {project.description && (
                  <p
                    className="mt-2 text-[13px] leading-[1.55]"
                    style={{ color: TEXT_SECONDARY }}
                  >
                    {project.description}
                  </p>
                )}
              </div>

              {/* Meta grid */}
              <div
                className="rounded-2xl p-4 space-y-3"
                style={{ backgroundColor: WARM_CHIP }}
              >
                <div className="flex items-start gap-2.5">
                  <CalendarIcon
                    className="w-4 h-4 mt-0.5 flex-shrink-0"
                    strokeWidth={1.75}
                    style={{ color: TEXT_MUTED }}
                  />
                  <div className="min-w-0">
                    <p
                      className="text-[13px] font-semibold"
                      style={{ color: TEXT_PRIMARY, letterSpacing: '-0.005em' }}
                    >
                      {dateDisplay}
                    </p>
                    {timeDisplay && (
                      <p className="text-[12px] mt-0.5" style={{ color: TEXT_SECONDARY }}>
                        {timeDisplay}
                      </p>
                    )}
                  </div>
                </div>

                {project.locationText && (
                  <div className="flex items-start gap-2.5">
                    <MapPin
                      className="w-4 h-4 mt-0.5 flex-shrink-0"
                      strokeWidth={1.75}
                      style={{ color: TEXT_MUTED }}
                    />
                    <p className="text-[13px]" style={{ color: TEXT_PRIMARY }}>
                      {project.locationText}
                    </p>
                  </div>
                )}

                <div className="flex items-start gap-2.5">
                  <User
                    className="w-4 h-4 mt-0.5 flex-shrink-0"
                    strokeWidth={1.75}
                    style={{ color: TEXT_MUTED }}
                  />
                  <div className="min-w-0">
                    <p className="text-[12px]" style={{ color: TEXT_MUTED }}>
                      Requested by
                    </p>
                    <p
                      className="text-[13px] font-semibold"
                      style={{ color: TEXT_PRIMARY }}
                    >
                      {creatorName}
                    </p>
                  </div>
                </div>
              </div>

              {/* Approval gates (reusing existing bar) */}
              {project.approvalGates ? (
                <div>
                  <p
                    className="text-[10.5px] font-semibold uppercase tracking-[0.1em] mb-2"
                    style={{ color: TEXT_MUTED }}
                  >
                    Approval Gates
                  </p>
                  <ApprovalGatesBar gates={project.approvalGates as ApprovalGates} />
                  <div className="mt-3">
                    <ApprovalTimeline gates={project.approvalGates as ApprovalGates} compact />
                  </div>
                </div>
              ) : null}

              {/* Warning */}
              <div
                className="rounded-2xl px-4 py-3 flex items-start gap-2.5"
                style={{
                  backgroundColor: 'rgba(194, 136, 64, 0.08)',
                  border: '1px solid rgba(194, 136, 64, 0.2)',
                }}
              >
                <CheckCircle2
                  className="w-4 h-4 mt-0.5 flex-shrink-0"
                  strokeWidth={2}
                  style={{ color: '#c28840' }}
                />
                <p className="text-[12px] leading-[1.55]" style={{ color: '#8a5f2a' }}>
                  Approving this event will confirm it and publish it to the calendar. All stakeholders will be notified. This action cannot be undone without explicit cancellation.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div
              className="flex items-center gap-3 px-6 py-4 flex-shrink-0"
              style={{ borderTop: `1px solid ${HAIRLINE}` }}
            >
              <button
                onClick={onClose}
                disabled={isApproving}
                className="flex-1 py-2.5 rounded-full text-[13px] font-semibold transition-colors duration-200 cursor-pointer disabled:opacity-60"
                style={{ backgroundColor: WARM_CHIP, color: TEXT_PRIMARY }}
                onMouseEnter={(e) => {
                  if (!isApproving) e.currentTarget.style.backgroundColor = '#ede9e0'
                }}
                onMouseLeave={(e) => {
                  if (!isApproving) e.currentTarget.style.backgroundColor = WARM_CHIP
                }}
              >
                Cancel
              </button>
              <button
                onClick={onApprove}
                disabled={isApproving}
                className="flex-1 py-2.5 rounded-full text-[13px] font-semibold transition-all duration-200 cursor-pointer hover:-translate-y-px disabled:opacity-60 flex items-center justify-center gap-1.5"
                style={{
                  backgroundColor: TEXT_PRIMARY,
                  color: '#ffffff',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.04)',
                }}
              >
                {isApproving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Approving…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.5} />
                    Approve Event
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
