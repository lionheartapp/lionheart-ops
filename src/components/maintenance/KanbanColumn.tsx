'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import KanbanCard from './KanbanCard'
import type { WorkOrderTicket } from './WorkOrdersTable'

// ─── Status icon config ──────────────────────────────────────────────────────

type DotStyle = 'dashed' | 'outline' | 'half' | 'filled' | 'check'

const COLUMN_CONFIG: Record<
  string,
  { label: string; color: string; dot: DotStyle }
> = {
  BACKLOG: { label: 'Backlog', color: '#94a3b8', dot: 'dashed' },
  TODO: { label: 'Todo', color: '#3b82f6', dot: 'outline' },
  IN_PROGRESS: { label: 'In Progress', color: '#f59e0b', dot: 'half' },
  ON_HOLD: { label: 'On Hold', color: '#ef4444', dot: 'filled' },
  QA: { label: 'QA Review', color: '#ec4899', dot: 'half' },
  DONE: { label: 'Done', color: '#22c55e', dot: 'check' },
}

function StatusDot({ color, dot }: { color: string; dot: DotStyle }) {
  const size = 16
  const r = 5.5
  const cx = 8
  const cy = 8

  switch (dot) {
    case 'check':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <circle cx={cx} cy={cy} r="6" fill={color} />
          <path
            d="M5.5 8.2l1.8 1.8 3.2-3.5"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'filled':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <circle cx={cx} cy={cy} r="6" fill={color} />
        </svg>
      )
    case 'half':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <circle cx={cx} cy={cy} r={r} stroke={color} strokeWidth="1.5" />
          <path
            d={`M${cx} ${cy - r}A${r} ${r} 0 0 1 ${cx} ${cy + r}V${cy - r}z`}
            fill={color}
          />
        </svg>
      )
    case 'outline':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <circle cx={cx} cy={cy} r={r} stroke={color} strokeWidth="1.5" />
        </svg>
      )
    case 'dashed':
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={color}
            strokeWidth="1.5"
            strokeDasharray="3 2"
          />
        </svg>
      )
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  status: string
  tickets: WorkOrderTicket[]
  isValidTarget: boolean | null
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
  const config = COLUMN_CONFIG[status] ?? {
    label: status,
    color: '#94a3b8',
    dot: 'outline' as DotStyle,
  }

  const isDragInProgress = isValidTarget !== null
  const highlightValid = isDragInProgress && isValidTarget && isOver
  const highlightInvalid = isDragInProgress && !isValidTarget && isOver

  return (
    <div
      className={[
        'flex flex-col min-w-[280px] max-w-[320px] flex-shrink-0 rounded-xl transition-all duration-150',
        'bg-[#f7f7f6]',
        highlightValid ? 'bg-primary-50/60 ring-1 ring-primary-300' : '',
        highlightInvalid ? 'bg-red-50/40 ring-1 ring-red-300 opacity-70' : '',
        isDragInProgress && !isOver && isValidTarget
          ? 'ring-1 ring-primary-200/40'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ minHeight: 'calc(100vh - 340px)' }}
    >
      {/* Column header — Linear style: dot · label · count */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <StatusDot color={config.color} dot={config.dot} />
        <span className="text-[13px] font-medium text-slate-700">
          {config.label}
        </span>
        <span className="text-xs text-slate-400 tabular-nums">{tickets.length}</span>
      </div>

      {/* Card list */}
      <div
        ref={setNodeRef}
        className="flex-1 px-1.5 pb-2 space-y-[6px] overflow-y-auto"
      >
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

        {/* Drop hint during drag */}
        {isDragInProgress && isValidTarget && tickets.length === 0 && (
          <div className="flex items-center justify-center py-10 text-sm text-slate-400">
            Drop to change status
          </div>
        )}

        {/* Static empty state */}
        {!isDragInProgress && tickets.length === 0 && (
          <div className="flex items-center justify-center py-10">
            <p className="text-xs text-slate-300">No tickets</p>
          </div>
        )}
      </div>
    </div>
  )
}
