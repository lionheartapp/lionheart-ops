'use client'

import { useRouter } from 'next/navigation'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Camera, Bot } from 'lucide-react'
import type { WorkOrderTicket } from './WorkOrdersTable'

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_BADGE: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700 font-semibold',
  HIGH: 'bg-orange-100 text-orange-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW: 'bg-slate-100 text-slate-500',
}

const CATEGORY_LABEL: Record<string, string> = {
  ELECTRICAL: 'Electrical',
  PLUMBING: 'Plumbing',
  HVAC: 'HVAC',
  STRUCTURAL: 'Structural',
  CUSTODIAL_BIOHAZARD: 'Custodial',
  GROUNDS: 'Grounds',
  IT_AV: 'IT / AV',
  OTHER: 'Other',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAge(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(ms / 3600000)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(ms / 86400000)
  return `${days}d ago`
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface KanbanCardProps {
  ticket: WorkOrderTicket
  isOverlay?: boolean
  isPending?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function KanbanCard({ ticket, isOverlay, isPending }: KanbanCardProps) {
  const router = useRouter()
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
    ...(isOverlay ? { transform: 'rotate(2deg)', boxShadow: '0 20px 40px rgba(0,0,0,0.18)' } : {}),
  }

  const locationParts: string[] = []
  if (ticket.building) locationParts.push(ticket.building.name)
  if (ticket.room) {
    locationParts.push(ticket.room.displayName ?? ticket.room.roomNumber)
  }
  const location = locationParts.join(' › ')

  const hasPhotos = Array.isArray((ticket as WorkOrderTicket & { photos?: string[] }).photos) &&
    ((ticket as WorkOrderTicket & { photos?: string[] }).photos?.length ?? 0) > 0
  const hasAI = !!(ticket as WorkOrderTicket & { aiAnalysis?: unknown }).aiAnalysis

  function handleClick(e: React.MouseEvent) {
    // Don't navigate if user was dragging
    e.stopPropagation()
    router.push(`/maintenance/tickets/${ticket.id}`)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={[
        'ui-glass-hover p-3 rounded-xl cursor-grab active:cursor-grabbing select-none transition-all',
        isDragging && !isOverlay ? 'opacity-40 scale-[0.98]' : '',
        isPending ? 'ring-2 ring-amber-300 ring-offset-1' : '',
        isOverlay ? 'cursor-grabbing z-50' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Top row: ticket number + priority badge */}
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <span className="font-mono text-[11px] text-slate-400 leading-tight">{ticket.ticketNumber}</span>
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap ${PRIORITY_BADGE[ticket.priority] ?? 'bg-slate-100 text-slate-500'}`}
        >
          {ticket.priority}
        </span>
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-slate-800 leading-snug line-clamp-2 mb-1.5">
        {ticket.title}
      </p>

      {/* Category tag */}
      <div className="mb-1.5">
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200">
          {CATEGORY_LABEL[ticket.category] ?? ticket.category}
        </span>
      </div>

      {/* Location */}
      {location && (
        <p className="text-[11px] text-slate-400 truncate mb-1.5">{location}</p>
      )}

      {/* Footer: tech avatar + age + indicators */}
      <div className="flex items-center justify-between gap-1 mt-1">
        {/* Tech assignment */}
        {ticket.assignedTo ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-[9px] font-semibold flex-shrink-0">
              {getInitials(ticket.assignedTo.firstName, ticket.assignedTo.lastName)}
            </div>
            <span className="text-[10px] text-slate-500 truncate">
              {ticket.assignedTo.firstName} {ticket.assignedTo.lastName}
            </span>
          </div>
        ) : (
          <span className="text-[10px] text-slate-300 italic">Unassigned</span>
        )}

        {/* Right side: icons + age */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {hasPhotos && (
            <Camera className="w-3 h-3 text-slate-300" />
          )}
          {hasAI && (
            <Bot className="w-3 h-3 text-blue-300" />
          )}
          <span className="text-[10px] text-slate-300">{formatAge(ticket.createdAt)}</span>
        </div>
      </div>
    </div>
  )
}
