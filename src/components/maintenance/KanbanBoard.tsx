'use client'

import { useState, useMemo } from 'react'
import KanbanColumn from './KanbanColumn'
import WorkOrdersFilters, { type WorkOrdersFilterState } from './WorkOrdersFilters'
import type { WorkOrderTicket } from './WorkOrdersTable'
import { User, Users } from 'lucide-react'
import { useAnimatedTabIndicator } from '@/lib/hooks/useAnimatedTabIndicator'
import TabIndicator from '@/components/ui/TabIndicator'
import { IllustrationTickets } from '@/components/illustrations'

// ─── Constants ────────────────────────────────────────────────────────────────

export const BOARD_COLUMNS = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'ON_HOLD', 'QA', 'DONE'] as const
type BoardColumn = (typeof BOARD_COLUMNS)[number]

type BoardViewTab = 'my-board' | 'team-board'

interface Technician {
  id: string
  firstName: string
  lastName: string
}

interface KanbanBoardProps {
  tickets: WorkOrderTicket[]
  isLoading: boolean
  filters: WorkOrdersFilterState
  onFilterChange: (f: WorkOrdersFilterState) => void
  technicians: Technician[]
  currentUserId: string
  canManage: boolean
  canClaim: boolean
  queryKeys: unknown[][]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupByStatus(tickets: WorkOrderTicket[]): Record<string, WorkOrderTicket[]> {
  const groups: Record<string, WorkOrderTicket[]> = {}
  for (const col of BOARD_COLUMNS) {
    groups[col] = []
  }
  for (const ticket of tickets) {
    if (ticket.status in groups) {
      groups[ticket.status].push(ticket)
    }
  }
  return groups
}

// ─── Main Board Component ─────────────────────────────────────────────────────

export default function KanbanBoard({
  tickets,
  isLoading,
  filters,
  onFilterChange,
  technicians,
  currentUserId,
  canManage,
  canClaim,
  queryKeys,
}: KanbanBoardProps) {
  // My Board should only show for users actually on the maintenance team —
  // super-admins get canClaim via wildcard but aren't maintenance techs
  const isOnMaintenanceTeam = technicians.some((t) => t.id === currentUserId)
  const showMyBoard = isOnMaintenanceTeam
  const [boardView, setBoardView] = useState<BoardViewTab>(showMyBoard ? 'my-board' : 'team-board')

  // Animated tab indicator
  const { containerRef: tabContainerRef, setTabRef, indicatorStyle } = useAnimatedTabIndicator(boardView, [canManage])

  // Ticket counts for tab badges
  const teamTicketCount = tickets.length
  const myTicketCount = useMemo(
    () => tickets.filter((t) => t.assignedTo?.id === currentUserId).length,
    [tickets, currentUserId]
  )

  // Filter tickets by board view tab
  const filteredByView = useMemo(() => {
    if (boardView === 'my-board') {
      return tickets.filter((t) => t.assignedTo?.id === currentUserId)
    }
    // 'team-board' shows all tickets (already filtered by campus via parent)
    return tickets
  }, [tickets, boardView, currentUserId])

  const grouped = useMemo(() => groupByStatus(filteredByView), [filteredByView])

  // ─── Skeleton ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-slate-100 rounded-xl animate-pulse w-64" />
        <div className="flex gap-3 overflow-hidden">
          {BOARD_COLUMNS.map((col) => (
            <div key={col} className="min-w-[280px] bg-[#f7f7f6] rounded-xl p-1.5 space-y-[6px] flex-shrink-0">
              <div className="flex items-center gap-2 px-1.5 py-2">
                <div className="w-4 h-4 rounded-full bg-slate-200 animate-pulse" />
                <div className="h-4 bg-slate-200 rounded animate-pulse w-20" />
              </div>
              {[1, 2].map((i) => (
                <div key={i} className="bg-white rounded-lg border border-slate-200/80 p-3 animate-pulse">
                  <div className="flex items-center justify-between mb-1">
                    <div className="h-3 bg-slate-100 rounded w-14" />
                    <div className="w-6 h-6 rounded-full bg-slate-100" />
                  </div>
                  <div className="h-4 bg-slate-100 rounded w-full mb-1" />
                  <div className="h-3.5 bg-slate-100 rounded w-3/4 mb-2.5" />
                  <div className="flex items-center gap-1.5">
                    <div className="h-5 bg-slate-100 rounded w-16" />
                    <div className="h-5 bg-slate-100 rounded w-10" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* View tabs — only for actual maintenance team members */}
      {showMyBoard && <div ref={tabContainerRef} className="relative flex gap-1 border-b border-slate-200">
        {(
          [
            { key: 'team-board' as BoardViewTab, label: 'Team Board', icon: Users, count: teamTicketCount },
            { key: 'my-board' as BoardViewTab, label: 'My Board', icon: User, count: myTicketCount },
          ]
        ).map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            ref={(el) => setTabRef(key, el)}
            onClick={() => setBoardView(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
              boardView === key
                ? 'text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-semibold rounded-full ${
              boardView === key
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-500'
            }`}>
              {count}
            </span>
          </button>
        ))}

        <TabIndicator style={indicatorStyle} />
      </div>}

      {/* Filters */}
      <WorkOrdersFilters
        filters={filters}
        onChange={onFilterChange}
        technicians={technicians}
        boardView={boardView}
      />

      {/* Board-level empty state */}
      {filteredByView.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <IllustrationTickets className="w-48 h-40 mb-2" />
          <p className="text-base font-semibold text-slate-700 mb-1">No tickets yet</p>
          <p className="text-sm text-slate-500 max-w-sm">
            {boardView === 'my-board'
              ? 'No tickets are assigned to you right now. Check the Team Board for unassigned work.'
              : 'Create a work order from the maintenance hub or submit a ticket to get started.'}
          </p>
        </div>
      ) : (
      <>
      {/* Mobile notice */}
      <p className="lg:hidden text-xs text-slate-400 text-center py-1">
        Swipe between columns. Tap a ticket to manage it.
      </p>

      <p className="hidden lg:block text-xs text-slate-400">
        Click a ticket to assign it or update status from the detail page.
      </p>

      {/* Kanban columns */}
      <div className="flex gap-3 overflow-x-auto pb-4 lg:overflow-x-auto snap-x snap-mandatory lg:snap-none">
        {BOARD_COLUMNS.map((col) => (
          <div key={col} className="snap-center lg:snap-none min-w-[85vw] lg:min-w-[280px]">
            <KanbanColumn
              status={col}
              tickets={grouped[col] ?? []}
            />
          </div>
        ))}
      </div>
      </>
      )}
    </div>
  )
}
