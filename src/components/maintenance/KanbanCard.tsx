'use client'

import { useRouter } from 'next/navigation'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Calendar, Camera, Bot } from 'lucide-react'
import type { WorkOrderTicket } from './WorkOrdersTable'

// ─── Constants ────────────────────────────────────────────────────────────────

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

const CATEGORY_DOT: Record<string, string> = {
  ELECTRICAL: '#EAB308',
  PLUMBING: '#3B82F6',
  HVAC: '#F97316',
  STRUCTURAL: '#6B7280',
  CUSTODIAL_BIOHAZARD: '#EF4444',
  GROUNDS: '#22C55E',
  IT_AV: '#8B5CF6',
  OTHER: '#9CA3AF',
}

const PRIORITY_COLOR: Record<string, string> = {
  URGENT: 'text-red-500',
  HIGH: 'text-orange-500',
  MEDIUM: 'text-amber-400',
  LOW: 'text-slate-300',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAge(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(ms / 3600000)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(ms / 86400000)
  return `${days}d`
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

/** Signal-bar priority icon matching Linear's visual weight indicator */
function PriorityIcon({ priority }: { priority: string }) {
  const color = PRIORITY_COLOR[priority] ?? 'text-slate-300'
  const filled =
    priority === 'URGENT' ? 4 : priority === 'HIGH' ? 3 : priority === 'MEDIUM' ? 2 : 1

  return (
    <div className={`flex gap-px items-end ${color}`} title={priority}>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`w-[3px] rounded-[0.5px] ${i <= filled ? 'bg-current' : 'bg-slate-200'}`}
          style={{ height: `${4 + i * 2}px` }}
        />
      ))}
    </div>
  )
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
    ...(isOverlay
      ? { transform: 'rotate(2deg)', boxShadow: '0 16px 40px rgba(0,0,0,0.16)' }
      : {}),
  }

  const hasPhotos =
    Array.isArray((ticket as WorkOrderTicket & { photos?: string[] }).photos) &&
    ((ticket as WorkOrderTicket & { photos?: string[] }).photos?.length ?? 0) > 0
  const hasAI = !!(ticket as WorkOrderTicket & { aiAnalysis?: unknown }).aiAnalysis

  function handleClick(e: React.MouseEvent) {
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
        'bg-white border border-slate-200/80 rounded-lg p-3 cursor-grab active:cursor-grabbing select-none',
        'hover:border-slate-300 transition-colors duration-100',
        isDragging && !isOverlay ? 'opacity-30 scale-[0.98]' : '',
        isPending ? 'ring-2 ring-amber-300 ring-offset-1' : '',
        isOverlay ? 'cursor-grabbing' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Row 1: ticket ID + assignee avatar */}
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-xs text-slate-400 leading-none">
          {ticket.ticketNumber}
        </span>
        {ticket.assignedTo ? (
          <div
            className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
            title={`${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}`}
          >
            {getInitials(ticket.assignedTo.firstName, ticket.assignedTo.lastName)}
          </div>
        ) : null}
      </div>

      {/* Row 2: title */}
      <p className="text-[13px] font-semibold text-slate-900 leading-snug line-clamp-2 mb-2.5">
        {ticket.title}
      </p>

      {/* Row 3: metadata badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Category with colored dot */}
        <span className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded border border-slate-200 text-[11px] text-slate-600 font-medium leading-none">
          <span
            className="w-[7px] h-[7px] rounded-full flex-shrink-0"
            style={{ backgroundColor: CATEGORY_DOT[ticket.category] ?? '#9CA3AF' }}
          />
          {CATEGORY_LABEL[ticket.category] ?? ticket.category}
        </span>

        {/* Age badge with clock icon */}
        <span className="inline-flex items-center gap-1 px-2 py-[3px] rounded border border-slate-200 text-[11px] text-slate-500 leading-none">
          <svg
            className="w-3 h-3 flex-shrink-0"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="8" cy="8" r="6" />
            <path d="M8 5v3.5l2 1.5" strokeLinecap="round" />
          </svg>
          {formatAge(ticket.createdAt)}
        </span>

        {/* Scheduled date */}
        {ticket.scheduledDate && (
          <span className="inline-flex items-center gap-1 px-2 py-[3px] rounded border border-slate-200 text-[11px] text-slate-500 leading-none">
            <Calendar className="w-3 h-3 flex-shrink-0" />
            {formatShortDate(ticket.scheduledDate)}
          </span>
        )}

        {/* Photo indicator */}
        {hasPhotos && (
          <span className="inline-flex items-center px-1.5 py-[3px] rounded border border-slate-200 text-slate-400">
            <Camera className="w-3 h-3" />
          </span>
        )}

        {/* AI indicator */}
        {hasAI && (
          <span className="inline-flex items-center px-1.5 py-[3px] rounded border border-blue-200 bg-blue-50/60 text-blue-400">
            <Bot className="w-3 h-3" />
          </span>
        )}

        {/* Priority bars — pushed to far right */}
        <div className="ml-auto pl-1">
          <PriorityIcon priority={ticket.priority} />
        </div>
      </div>
    </div>
  )
}
