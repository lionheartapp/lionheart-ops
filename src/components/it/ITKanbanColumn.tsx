'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import ITKanbanCard, { type KanbanTicket } from './ITKanbanCard'
import { STATUS_COLORS } from './ITStatusBadge'

interface ITKanbanColumnProps {
  status: string
  tickets: KanbanTicket[]
  onTicketClick: (id: string) => void
}

export default function ITKanbanColumn({ status, tickets, onTicketClick }: ITKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const statusInfo = STATUS_COLORS[status] ?? { bg: 'bg-slate-100', text: 'text-slate-700', label: status }

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-2xl bg-slate-50/80 border transition-colors ${
        isOver ? 'border-blue-300 bg-blue-50/30' : 'border-slate-200/50'
      }`}
    >
      {/* Column header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}>
            {statusInfo.label}
          </span>
          <span className="text-xs text-slate-400 font-medium">{tickets.length}</span>
        </div>
      </div>

      {/* Cards */}
      <SortableContext items={tickets.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 px-3 pb-3 space-y-2 min-h-[120px] overflow-y-auto max-h-[calc(100vh-280px)]">
          {tickets.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-xs text-slate-400">
              No tickets
            </div>
          ) : (
            tickets.map((ticket) => (
              <ITKanbanCard
                key={ticket.id}
                ticket={ticket}
                onClick={onTicketClick}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  )
}
