'use client'

/**
 * ArchiveDrawer — right-side drawer listing completed + cancelled events.
 *
 * These are kept off the main board to reduce noise (admins rarely need
 * to see old events day-to-day) but are still one click away via the
 * "Archive" button in the board header.
 *
 * Read-only — archived events can't be dragged back to active. If the user
 * wants to re-activate, they click through to the event detail page.
 */

import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { X, Archive as ArchiveIcon, Check, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  SURFACE,
  BORDER,
  HAIRLINE,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  WARM_CHIP,
  CARD_SHADOW,
  STATUS_ACCENT,
} from '@/lib/design/warm-tokens'
import type { EventProject } from '@/lib/hooks/useEventProject'

interface ArchiveDrawerProps {
  isOpen: boolean
  onClose: () => void
  projects: EventProject[]
}

export function ArchiveDrawer({ isOpen, onClose, projects }: ArchiveDrawerProps) {
  const router = useRouter()

  // Only show archived statuses
  const archived = projects
    .filter((p) => p.status === 'COMPLETED' || p.status === 'CANCELLED')
    .sort(
      (a, b) =>
        new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
    )

  const completedCount = archived.filter((p) => p.status === 'COMPLETED').length
  const cancelledCount = archived.filter((p) => p.status === 'CANCELLED').length

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40"
            style={{ backgroundColor: 'rgba(17, 15, 10, 0.3)' }}
            onClick={onClose}
          />

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
              <div className="flex items-center gap-2.5">
                <ArchiveIcon
                  className="w-5 h-5"
                  strokeWidth={1.75}
                  style={{ color: TEXT_SECONDARY }}
                />
                <h2
                  className="text-[17px] font-semibold"
                  style={{ color: TEXT_PRIMARY, letterSpacing: '-0.015em' }}
                >
                  Archive
                </h2>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer"
                style={{ color: TEXT_SECONDARY }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = WARM_CHIP)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                aria-label="Close archive"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stats strip */}
            <div
              className="flex items-center gap-4 px-6 py-3 flex-shrink-0"
              style={{ borderBottom: `1px solid ${HAIRLINE}` }}
            >
              <div className="flex items-center gap-1.5">
                <Check
                  className="w-3.5 h-3.5"
                  strokeWidth={2.5}
                  style={{ color: STATUS_ACCENT.COMPLETED }}
                />
                <span className="text-[12px]" style={{ color: TEXT_SECONDARY }}>
                  {completedCount} completed
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <XCircle
                  className="w-3.5 h-3.5"
                  strokeWidth={2}
                  style={{ color: STATUS_ACCENT.CANCELLED }}
                />
                <span className="text-[12px]" style={{ color: TEXT_SECONDARY }}>
                  {cancelledCount} cancelled
                </span>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {archived.length === 0 ? (
                <div className="text-center py-16">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: WARM_CHIP }}
                  >
                    <ArchiveIcon
                      className="w-7 h-7"
                      strokeWidth={1.75}
                      style={{ color: TEXT_PRIMARY }}
                    />
                  </div>
                  <p
                    className="text-[14px] font-semibold mb-1"
                    style={{ color: TEXT_PRIMARY, letterSpacing: '-0.01em' }}
                  >
                    Archive is empty
                  </p>
                  <p className="text-[12px]" style={{ color: TEXT_SECONDARY }}>
                    Completed and cancelled events will appear here.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {archived.map((project) => {
                    const accentColor = STATUS_ACCENT[project.status] ?? TEXT_MUTED
                    const startsAt = new Date(project.startsAt)
                    return (
                      <li key={project.id}>
                        <button
                          onClick={() => {
                            router.push(`/events/${project.id}`)
                            onClose()
                          }}
                          className="w-full text-left px-3 py-2.5 rounded-xl transition-colors cursor-pointer"
                          style={{ backgroundColor: 'transparent' }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor = WARM_CHIP)
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor = 'transparent')
                          }
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="w-1 rounded-full flex-shrink-0 self-stretch my-0.5"
                              style={{ backgroundColor: accentColor }}
                            />
                            <div className="flex-1 min-w-0">
                              <p
                                className="text-[13px] font-semibold truncate"
                                style={{
                                  color: TEXT_PRIMARY,
                                  letterSpacing: '-0.005em',
                                }}
                              >
                                {project.title}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span
                                  className="text-[11px]"
                                  style={{ color: TEXT_SECONDARY }}
                                >
                                  {format(startsAt, 'MMM d, yyyy')}
                                </span>
                                <span style={{ color: TEXT_MUTED }}>·</span>
                                <span
                                  className="text-[10px] font-semibold uppercase tracking-[0.05em]"
                                  style={{ color: accentColor }}
                                >
                                  {project.status === 'COMPLETED' ? 'Completed' : 'Cancelled'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
