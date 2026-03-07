'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { PriorityBadge, TypeBadge } from './ITStatusBadge'
import { User } from 'lucide-react'

export interface KanbanTicket {
  id: string
  ticketNumber: string
  title: string
  status: string
  priority: string
  issueType: string
  createdAt: string
  submittedBy?: { firstName: string; lastName: string; avatar?: string | null } | null
  assignedTo?: { firstName: string; lastName: string; avatar?: string | null } | null
  building?: { name: string } | null
  room?: { roomNumber?: string; displayName?: string | null } | null
  school?: { name: string } | null
}

interface ITKanbanCardProps {
  ticket: KanbanTicket
  onClick: (id: string) => void
}

export default function ITKanbanCard({ ticket, onClick }: ITKanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ticket.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const location = [
    ticket.building?.name,
    ticket.room?.displayName || ticket.room?.roomNumber,
  ].filter(Boolean).join(' › ')

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(ticket.id)}
      className="p-3 bg-white rounded-xl border border-gray-200/50 shadow-sm hover:shadow-md cursor-pointer transition-shadow active:scale-[0.98]"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono text-[10px] text-gray-400">{ticket.ticketNumber}</span>
        <PriorityBadge priority={ticket.priority} />
      </div>
      <p className="text-sm font-medium text-gray-900 line-clamp-2 mb-2">{ticket.title}</p>
      <div className="flex items-center justify-between">
        <TypeBadge type={ticket.issueType} />
        {ticket.assignedTo ? (
          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-medium text-blue-700" title={`${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}`}>
            {ticket.assignedTo.firstName[0]}{ticket.assignedTo.lastName[0]}
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
            <User className="w-3 h-3 text-gray-400" />
          </div>
        )}
      </div>
      {location && (
        <p className="text-[10px] text-gray-400 mt-1.5 truncate">{location}</p>
      )}
    </div>
  )
}
