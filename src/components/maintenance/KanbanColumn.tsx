'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import KanbanCard from './KanbanCard'
import type { WorkOrderTicket } from './WorkOrdersTable'

// ─── Column status config ─────────────────────────────────────────────────────

const COLUMN_CONFIG: Record<string, { label: string; badgeColor: string }> = {
  BACKLOG: { label: 'Backlog', badgeColor: 'bg-gray-200 text-gray-600' },
  TODO: { label: 'To Do', badgeColor: 'bg-blue-100 text-blue-700' },
  IN_PROGRESS: { label: 'In Progress', badgeColor: 'bg-amber-100 text-amber-700' },
  ON_HOLD: { label: 'On Hold', badgeColor: 'bg-red-100 text-red-700' },
  QA: { label: 'QA Review', badgeColor: 'bg-pink-100 text-pink-700' },
  DONE: { label: 'Done', badgeColor: 'bg-primary-100 text-primary-700' },
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  status: string
  tickets: WorkOrderTicket[]
  isValidTarget: boolean | null  // null = no drag in progress, true/false = valid/invalid
  pendingTicketId?: string | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function KanbanColumn({
  status,
  tickets,
  isValidTarget,
  pendingTicketId,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const config = COLUMN_CONFIG[status] ?? { label: status, badgeColor: 'bg-gray-100 text-gray-600' }

  // Visual state for column highlight
  const isDragInProgress = isValidTarget !== null
  const highlightValid = isDragInProgress && isValidTarget && isOver
  const highlightInvalid = isDragInProgress && !isValidTarget && isOver

  return (
    <div
      className={[
        'flex flex-col min-w-[280px] max-w-[320px] flex-shrink-0 rounded-2xl transition-all duration-150',
        'bg-white border border-gray-200 shadow-sm',
        highlightValid ? 'ring-2 ring-primary-400 bg-primary-50/40' : '',
        highlightInvalid ? 'ring-2 ring-red-400 opacity-70 bg-red-50/20' : '',
        isDragInProgress && !isOver && isValidTarget ? 'ring-1 ring-primary-200' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ minHeight: 'calc(100vh - 320px)' }}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200">
        <span className="text-sm font-semibold text-gray-900">{config.label}</span>
        <span
          className={`inline-flex items-center justify-center min-w-[22px] px-1.5 py-0.5 rounded-full text-xs font-semibold ${config.badgeColor}`}
        >
          {tickets.length}
        </span>
      </div>

      {/* Card list */}
      <div ref={setNodeRef} className="flex-1 p-2 space-y-2 overflow-y-auto">
        <SortableContext
          items={tickets.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tickets.map((ticket) => (
            <KanbanCard
              key={ticket.id}
              ticket={ticket}
              isPending={pendingTicketId === ticket.id}
            />
          ))}
        </SortableContext>

        {tickets.length === 0 && (
          <div className="flex items-center justify-center py-8 text-xs text-gray-400">
            No tickets
          </div>
        )}
      </div>
    </div>
  )
}
