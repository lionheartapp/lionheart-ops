'use client'

/**
 * EventBoardColumn — a droppable kanban column for the events board.
 *
 * Handles:
 *  - Column header (title, count, optional AI-ranked badge, optional + button)
 *  - Drop zone for cards via @dnd-kit's useDroppable
 *  - Scrollable card list
 *  - Empty state per column
 */

import { useDroppable } from '@dnd-kit/core'
import { Plus, Sparkles } from 'lucide-react'
import { EventBoardCard } from './EventBoardCard'
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
import type { EventTransitionStatus } from '@/lib/hooks/useEventProject'

interface EventBoardColumnProps {
  status: EventTransitionStatus
  title: string
  projects: EventProject[]
  /** Show AI-ranked badge (used on Pending Approval column) */
  aiRanked?: boolean
  /** Show + button in header (used on Draft column) */
  onAdd?: () => void
  /** Whether this column is a valid drop target for the currently-dragged card */
  isValidDropTarget?: boolean
  /** Whether there's an active drag anywhere on the board */
  isDragActive?: boolean
  /** Current user's ID — used to mark owned cards */
  currentUserId?: string | null
}

export function EventBoardColumn({
  status,
  title,
  projects,
  aiRanked = false,
  onAdd,
  isValidDropTarget = true,
  isDragActive = false,
  currentUserId,
}: EventBoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${status}`,
    data: { type: 'column', status },
    disabled: !isValidDropTarget,
  })

  const accentColor = STATUS_ACCENT[status] ?? TEXT_MUTED
  const count = projects.length

  // Drop zone visual state:
  //  - Dimmed: when a card is being dragged and this column cannot accept it
  //  - Highlighted: when hovering with a valid card
  //  - Default: no active drag
  const columnOpacity = isDragActive && !isValidDropTarget ? 0.4 : 1
  const columnBg = isOver && isValidDropTarget ? '#f8f6f2' : 'transparent'
  const columnBorder = isOver && isValidDropTarget
    ? `2px dashed ${accentColor}`
    : `1px dashed ${BORDER}`

  return (
    <div
      className="flex flex-col flex-1 min-w-[260px] max-w-[340px] rounded-2xl transition-opacity duration-200"
      style={{ opacity: columnOpacity }}
    >
      {/* Column header */}
      <div className="flex items-center justify-between gap-2 mb-3 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: accentColor }}
          />
          <h3
            className="text-[12px] font-semibold uppercase tracking-[0.08em] truncate"
            style={{ color: TEXT_PRIMARY, letterSpacing: '0.08em' }}
          >
            {title}
          </h3>
          <span
            className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: WARM_CHIP, color: TEXT_SECONDARY }}
          >
            {count}
          </span>
          {aiRanked && count > 0 && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9.5px] font-semibold rounded-full flex-shrink-0"
              style={{ backgroundColor: WARM_CHIP, color: TEXT_SECONDARY }}
              title="Sorted by AI urgency score"
            >
              <Sparkles className="w-2.5 h-2.5" strokeWidth={2} />
              AI
            </span>
          )}
        </div>
        {onAdd && (
          <button
            onClick={onAdd}
            className="w-6 h-6 rounded-full flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
            style={{ color: TEXT_MUTED }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = WARM_CHIP
              e.currentTarget.style.color = TEXT_PRIMARY
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = TEXT_MUTED
            }}
            aria-label={`Add event to ${title}`}
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className="flex-1 min-h-[100px] rounded-2xl p-2 space-y-2 transition-colors duration-150"
        style={{
          backgroundColor: columnBg,
          border: columnBorder,
        }}
      >
        {count === 0 ? (
          <div
            className="flex items-center justify-center h-full py-8 text-center"
            style={{ minHeight: '120px' }}
          >
            <p className="text-[11px]" style={{ color: TEXT_MUTED }}>
              {isOver && isValidDropTarget
                ? 'Drop here'
                : isDragActive && !isValidDropTarget
                  ? "Can't drop here"
                  : 'No events'}
            </p>
          </div>
        ) : (
          projects.map((project) => (
            <EventBoardCard
              key={project.id}
              project={project}
              isOwned={!!currentUserId && project.createdById === currentUserId}
            />
          ))
        )}
      </div>
    </div>
  )
}
