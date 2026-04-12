'use client'

/**
 * EventBoardCard — compact draggable card used in the kanban board.
 *
 * Smaller than the full EventCard from the list view — shows only the
 * essentials so 4-6 cards fit per column. Drag handles come from @dnd-kit's
 * useDraggable hook. Clicking navigates to the event detail page; drag
 * events don't fire click, so the two interactions coexist cleanly.
 */

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import { MapPin } from 'lucide-react'
import {
  SURFACE,
  BORDER,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  WARM_CHIP,
  STATUS_ACCENT,
} from '@/lib/design/warm-tokens'
import type { EventProject } from '@/lib/hooks/useEventProject'

interface EventBoardCardProps {
  project: EventProject
  /** Whether drag is enabled for this card (false for archived / non-draggable columns) */
  isDraggable?: boolean
  /** Whether the current user created this event */
  isOwned?: boolean
}

function getInitials(firstName?: string | null, lastName?: string | null, email?: string): string {
  if (firstName) {
    const first = firstName.charAt(0).toUpperCase()
    const last = lastName?.charAt(0)?.toUpperCase() || ''
    return first + last
  }
  return email?.charAt(0).toUpperCase() || '?'
}

export function EventBoardCard({ project, isDraggable = true, isOwned = false }: EventBoardCardProps) {
  const router = useRouter()
  const startsAt = new Date(project.startsAt)
  const isToday = startsAt.toDateString() === new Date().toDateString()
  const weekday = startsAt.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  const dayNum = startsAt.getDate()
  const monthShort = startsAt.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  const accentColor = STATUS_ACCENT[project.status] ?? STATUS_ACCENT.DRAFT

  const creatorInitials = getInitials(
    project.createdBy?.firstName,
    project.createdBy?.lastName,
    project.createdBy?.email,
  )

  // dnd-kit draggable setup
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: project.id,
    data: {
      type: 'event-project',
      fromStatus: project.status,
      project,
    },
    disabled: !isDraggable,
  })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    backgroundColor: SURFACE,
    border: `1px solid ${BORDER}`,
    boxShadow: isDragging
      ? '0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.08)'
      : '0 0.8px 2.9px rgba(0,0,0,0.02), 0 2px 7.8px rgba(0,0,0,0.027), 0 4px 18px rgba(0,0,0,0.04)',
    opacity: isDragging ? 0.5 : 1,
    cursor: isDraggable ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
    touchAction: 'none',
  }

  const handleClick = (e: React.MouseEvent) => {
    // dnd-kit fires click on drag-end if the drag was a "no-op" (no movement).
    // We still want to navigate in that case — but NOT if we're in the middle
    // of an active drag.
    if (isDragging) return
    e.stopPropagation()
    router.push(`/events/${project.id}`)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      className="group rounded-2xl p-3 flex gap-3 transition-colors duration-200 hover:bg-[#f8f6f2] select-none"
      role="button"
      tabIndex={0}
      aria-label={`Event: ${project.title}`}
    >
      {/* Date chip */}
      <div className="flex-shrink-0 w-10 text-center pt-0.5">
        <div
          className="text-[9px] font-bold uppercase tracking-[0.1em]"
          style={{ color: isToday ? accentColor : TEXT_MUTED }}
        >
          {isToday ? 'TODAY' : weekday}
        </div>
        <div
          className="text-[18px] font-semibold leading-[1.1] mt-0.5"
          style={{ color: TEXT_PRIMARY }}
        >
          {dayNum}
        </div>
        <div
          className="text-[8.5px] font-semibold uppercase tracking-[0.08em] mt-0.5"
          style={{ color: TEXT_MUTED }}
        >
          {monthShort}
        </div>
      </div>

      {/* Vertical accent bar */}
      <div
        className="flex-shrink-0 w-[2.5px] rounded-full self-stretch my-0.5"
        style={{ backgroundColor: accentColor }}
      />

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <h4
          className="text-[13px] font-semibold leading-tight line-clamp-2"
          style={{ color: TEXT_PRIMARY, letterSpacing: '-0.005em' }}
        >
          {project.title}
        </h4>

        {project.locationText && (
          <div className="flex items-center gap-1 mt-1.5">
            <MapPin
              className="w-3 h-3 flex-shrink-0"
              strokeWidth={1.75}
              style={{ color: TEXT_MUTED }}
            />
            <span
              className="text-[11px] truncate"
              style={{ color: TEXT_SECONDARY }}
            >
              {project.locationText}
            </span>
          </div>
        )}

        {/* Footer row: creator initials + ownership badge + time */}
        <div className="flex items-center gap-2 mt-2">
          {creatorInitials && (
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold flex-shrink-0"
              style={{
                backgroundColor: isOwned ? '#e8e3d9' : WARM_CHIP,
                color: isOwned ? TEXT_PRIMARY : TEXT_SECONDARY,
              }}
              title={
                project.createdBy?.firstName
                  ? `${project.createdBy.firstName} ${project.createdBy.lastName || ''}`.trim()
                  : project.createdBy?.email || 'Unknown'
              }
            >
              {creatorInitials}
            </div>
          )}
          {isOwned && (
            <span
              className="text-[9px] font-semibold uppercase tracking-[0.04em] px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: '#e8e3d9', color: TEXT_PRIMARY }}
            >
              You
            </span>
          )}
          <span className="text-[10.5px]" style={{ color: TEXT_MUTED }}>
            {format(startsAt, 'h:mm a')}
          </span>
        </div>
      </div>
    </div>
  )
}
