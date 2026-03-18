'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { PriorityBadge, TypeBadge } from './ITStatusBadge'
import { User, Camera } from 'lucide-react'

export interface KanbanTicket {
  id: string
  ticketNumber: string
  title: string
  status: string
  priority: string
  issueType: string
  source?: string
  photos?: string[]
  createdAt: string
  submittedBy?: { firstName: string; lastName: string; avatar?: string | null } | null
  assignedTo?: { firstName: string; lastName: string; avatar?: string | null } | null
  building?: { name: string } | null
  room?: { roomNumber?: string; displayName?: string | null } | null
  school?: { name: string } | null
}

function getRelativeTime(dateStr: string): { text: string; color: string } {
  const now = Date.now()
  const created = new Date(dateStr).getTime()
  const diffMs = now - created
  const diffHours = diffMs / (1000 * 60 * 60)
  const diffDays = diffHours / 24

  let text: string
  if (diffDays >= 1) {
    text = `${Math.floor(diffDays)}d ago`
  } else if (diffHours >= 1) {
    text = `${Math.floor(diffHours)}h ago`
  } else {
    text = 'just now'
  }

  // Color coding: gray <24h, amber 24-48h, red >48h
  let color: string
  if (diffHours > 48) {
    color = 'text-red-500'
  } else if (diffHours > 24) {
    color = 'text-amber-500'
  } else {
    color = 'text-slate-400'
  }

  return { text, color }
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
  ].filter(Boolean).join(' > ')

  const age = getRelativeTime(ticket.createdAt)
  const photoCount = ticket.photos?.length ?? 0
  const isSub = ticket.source === 'SUB_SUBMITTED'

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(ticket.id)}
      className="p-3 bg-white rounded-xl border border-slate-200/50 shadow-sm hover:shadow-md cursor-pointer transition-shadow active:scale-[0.98]"
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-slate-400">{ticket.ticketNumber}</span>
          {isSub && (
            <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-amber-100 text-amber-700 rounded-full leading-none">
              SUB
            </span>
          )}
        </div>
        <PriorityBadge priority={ticket.priority} />
      </div>
      <p className="text-sm font-medium text-slate-900 line-clamp-2 mb-2">{ticket.title}</p>
      <div className="flex items-center justify-between">
        <TypeBadge type={ticket.issueType} />
        {ticket.assignedTo ? (
          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-medium text-blue-700" title={`${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}`}>
            {ticket.assignedTo.firstName[0]}{ticket.assignedTo.lastName[0]}
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
            <User className="w-3 h-3 text-slate-400" />
          </div>
        )}
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {location && (
            <p className="text-[10px] text-slate-400 truncate">{location}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {photoCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
              <Camera className="w-3 h-3" />
              {photoCount}
            </span>
          )}
          <span className={`text-[10px] ${age.color}`}>{age.text}</span>
        </div>
      </div>
    </div>
  )
}
