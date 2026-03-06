'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, LayoutGrid, List } from 'lucide-react'
import { fetchApi, getAuthHeaders } from '@/lib/api-client'
import { staggerContainer, fadeInUp, expandCollapse } from '@/lib/animations'
import { usePermissions } from '@/lib/hooks/usePermissions'
import WorkOrdersFilters, {
  DEFAULT_FILTERS,
  type WorkOrdersFilterState,
} from './WorkOrdersFilters'
import WorkOrdersTable, {
  ScheduledTicketsTable,
  type WorkOrderTicket,
  type SortField,
  type SortState,
} from './WorkOrdersTable'
import KanbanBoard from './KanbanBoard'

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Campus {
  id: string
  name: string
}

interface Technician {
  id: string
  firstName: string
  lastName: string
}

interface WorkOrdersViewProps {
  activeCampusId: string | null
  campuses: Campus[]
}

// ─── API helpers ──────────────────────────────────────────────────────────────

function buildTicketQueryParams(
  filters: WorkOrdersFilterState,
  excludeStatus?: string
): string {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.priority) params.set('priority', filters.priority)
  if (filters.category) params.set('category', filters.category)
  if (filters.schoolId) params.set('schoolId', filters.schoolId)
  if (filters.assignedToId) params.set('assignedToId', filters.assignedToId)
  if (filters.search) params.set('search', filters.search)
  if (filters.unassigned) params.set('unassigned', 'true')
  if (excludeStatus) params.set('excludeStatus', excludeStatus)
  return params.toString()
}

async function claimTicketApi(ticketId: string): Promise<WorkOrderTicket> {
  return fetchApi<WorkOrderTicket>(`/api/maintenance/tickets/${ticketId}/claim`, {
    method: 'POST',
    headers: getAuthHeaders(),
  })
}

async function assignTicketApi(ticketId: string, techId: string): Promise<WorkOrderTicket> {
  return fetchApi<WorkOrderTicket>(`/api/maintenance/tickets/${ticketId}`, {
    method: 'PATCH',
    body: JSON.stringify({ assignedToId: techId }),
  })
}

async function changeStatusApi(
  ticketId: string,
  status: string,
  extra?: Record<string, string>
): Promise<WorkOrderTicket> {
  return fetchApi<WorkOrderTicket>(`/api/maintenance/tickets/${ticketId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, ...extra }),
  })
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WorkOrdersView({ activeCampusId, campuses }: WorkOrdersViewProps) {
  const queryClient = useQueryClient()
  const { data: perms } = usePermissions()

  const canManage = perms?.canManageMaintenance ?? false
  const canClaim = perms?.canClaimMaintenance ?? false
  const canAssign = canManage
  const canChangeStatus = canManage || canClaim

  // View mode: board (Kanban) or table
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board')

  // Filter state
  const [filters, setFilters] = useState<WorkOrdersFilterState>({
    ...DEFAULT_FILTERS,
    schoolId: activeCampusId ?? '',
  })

  // Sort state (default: priority desc, then age asc handled inside table)
  const [sort, setSort] = useState<SortState>({ field: 'priority', dir: 'desc' })

  // Specialty toggle (for technician view)
  const [showAll, setShowAll] = useState(false)

  // Scheduled section collapse state
  const [scheduledOpen, setScheduledOpen] = useState(false)

  // Track which ticket is being claimed (for optimistic UI)
  const [claimingId, setClaimingId] = useState<string | null>(null)

  // Current user ID from localStorage (for "My Board" filtering)
  const currentUserId =
    typeof window !== 'undefined' ? (localStorage.getItem('user-id') ?? '') : ''

  // Main tickets query (exclude SCHEDULED)
  const mainQueryKey = ['maintenance-tickets', filters, 'exclude-scheduled']
  const { data: mainTickets = [], isLoading: mainLoading } = useQuery({
    queryKey: mainQueryKey,
    queryFn: async () => {
      const qs = buildTicketQueryParams(filters, 'SCHEDULED')
      const data = await fetchApi<WorkOrderTicket[]>(`/api/maintenance/tickets?${qs}`)
      return data
    },
    staleTime: 30 * 1000,
  })

  // Scheduled tickets query
  const scheduledQueryKey = ['maintenance-tickets-scheduled']
  const { data: scheduledTickets = [] } = useQuery({
    queryKey: scheduledQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ status: 'SCHEDULED' })
      if (filters.schoolId) params.set('schoolId', filters.schoolId)
      return fetchApi<WorkOrderTicket[]>(`/api/maintenance/tickets?${params}`)
    },
    staleTime: 30 * 1000,
  })

  // Technicians query (members with maintenance access)
  const { data: technicians = [] } = useQuery({
    queryKey: ['maintenance-technicians'],
    queryFn: async () => {
      const members = await fetchApi<
        { id: string; firstName: string; lastName: string; canClaimMaintenance?: boolean }[]
      >('/api/settings/users')
      // For simplicity, show all members as potential assignees
      return members.map((m) => ({
        id: m.id,
        firstName: m.firstName,
        lastName: m.lastName,
      }))
    },
    staleTime: 5 * 60 * 1000,
    enabled: canAssign,
  })

  // ─── Claim mutation (optimistic) ──────────────────────────────────────────

  const claimMutation = useMutation({
    mutationFn: (ticketId: string) => claimTicketApi(ticketId),
    onMutate: async (ticketId) => {
      setClaimingId(ticketId)
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: mainQueryKey })
      // Snapshot current data
      const snapshot = queryClient.getQueryData<WorkOrderTicket[]>(mainQueryKey)
      // Optimistically update: mark as assigned with a placeholder
      queryClient.setQueryData<WorkOrderTicket[]>(mainQueryKey, (old) =>
        (old ?? []).map((t) =>
          t.id === ticketId
            ? { ...t, assignedTo: { id: '__optimistic__', firstName: 'You', lastName: '' }, status: 'TODO' }
            : t
        )
      )
      return { snapshot }
    },
    onError: (_err, _ticketId, context) => {
      // Rollback
      if (context?.snapshot) {
        queryClient.setQueryData(mainQueryKey, context.snapshot)
      }
    },
    onSettled: () => {
      setClaimingId(null)
      queryClient.invalidateQueries({ queryKey: ['maintenance-tickets'] })
    },
  })

  // ─── Assign mutation ──────────────────────────────────────────────────────

  const assignMutation = useMutation({
    mutationFn: ({ ticketId, techId }: { ticketId: string; techId: string }) =>
      assignTicketApi(ticketId, techId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-tickets'] })
    },
  })

  // ─── Status change mutation ───────────────────────────────────────────────

  const statusMutation = useMutation({
    mutationFn: ({
      ticketId,
      status,
      extra,
    }: {
      ticketId: string
      status: string
      extra?: Record<string, string>
    }) => changeStatusApi(ticketId, status, extra),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-tickets'] })
    },
  })

  // ─── Sort toggle ──────────────────────────────────────────────────────────

  function handleSort(field: SortField) {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: field === 'priority' ? 'desc' : 'asc' }
    )
  }

  // ─── Specialty filtering ──────────────────────────────────────────────────

  const displayedTickets = useCallback(() => {
    // If user is not a tech or perms are admin, show all
    if (!canClaim || canManage) return mainTickets
    // Tech view: filter to specialty matches unless showAll
    if (!showAll) {
      return mainTickets.filter((t) => t.matchesSpecialty !== false)
    }
    return mainTickets
  }, [mainTickets, canClaim, canManage, showAll])()

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <motion.div
      className="space-y-4"
      initial="hidden"
      animate="visible"
      variants={staggerContainer(0.06, 0.04)}
    >
      {/* Header row */}
      <motion.div variants={fadeInUp} className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Work Orders</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {mainLoading
              ? 'Loading tickets...'
              : `${displayedTickets.length} ticket${displayedTickets.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Specialty toggle — shown only for technicians (canClaim but not canManage) */}
          {canClaim && !canManage && (
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-400 cursor-pointer"
              />
              Show all (including other specialties)
            </label>
          )}

          {/* Board / Table toggle */}
          <div className="flex items-center gap-0.5 p-0.5 bg-gray-100 rounded-lg">
            <button
              onClick={() => setViewMode('board')}
              title="Board view"
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                viewMode === 'board'
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              title="Table view"
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Board view */}
      {viewMode === 'board' && (
        <motion.div variants={fadeInUp}>
          <KanbanBoard
            tickets={displayedTickets}
            isLoading={mainLoading}
            filters={filters}
            onFilterChange={setFilters}
            campuses={campuses}
            technicians={technicians}
            currentUserId={currentUserId}
            activeCampusId={activeCampusId}
            canManage={canManage}
            queryKeys={[['maintenance-tickets'], scheduledQueryKey]}
          />
        </motion.div>
      )}

      {/* Table view */}
      {viewMode === 'table' && (
        <>
          {/* Filters */}
          <motion.div variants={fadeInUp}>
            <WorkOrdersFilters
              filters={filters}
              onChange={setFilters}
              campuses={campuses}
              technicians={technicians}
            />
          </motion.div>

          {/* Main table */}
          <motion.div variants={fadeInUp}>
            <WorkOrdersTable
              tickets={displayedTickets}
              isLoading={mainLoading}
              sort={sort}
              onSort={handleSort}
              canClaim={canClaim}
              canAssign={canAssign}
              canChangeStatus={canChangeStatus}
              showSpecialtyHighlight={canClaim && !canManage && showAll}
              technicians={technicians}
              onClaim={(ticketId) => claimMutation.mutate(ticketId)}
              onAssign={(ticketId, techId) => assignMutation.mutate({ ticketId, techId })}
              onStatusChange={(ticketId, status, extra) =>
                statusMutation.mutate({ ticketId, status, extra })
              }
              claimingId={claimingId}
            />
          </motion.div>

          {/* Scheduled tickets collapsible section */}
          {scheduledTickets.length > 0 && (
            <motion.div variants={fadeInUp} className="ui-glass rounded-2xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer hover:bg-gray-50/50 transition-colors"
                onClick={() => setScheduledOpen((o) => !o)}
                aria-expanded={scheduledOpen}
              >
                <div className="flex items-center gap-2">
                  {scheduledOpen ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="text-sm font-semibold text-gray-700">
                    Scheduled ({scheduledTickets.length})
                  </span>
                  <span className="text-xs text-gray-400">— sorted by scheduled date</span>
                </div>
              </button>

              <AnimatePresence initial={false}>
                {scheduledOpen && (
                  <motion.div
                    key="scheduled-section"
                    variants={expandCollapse}
                    initial="collapsed"
                    animate="expanded"
                    exit="collapsed"
                    className="overflow-hidden border-t border-gray-100"
                  >
                    <div className="p-1">
                      <ScheduledTicketsTable tickets={scheduledTickets} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Empty scheduled section placeholder when no scheduled tickets */}
          {!mainLoading && scheduledTickets.length === 0 && (
            <motion.div variants={fadeInUp}>
              <button
                className="w-full flex items-center gap-2 px-5 py-3 ui-glass rounded-2xl text-left cursor-pointer hover:bg-gray-50/50 transition-colors opacity-50"
                onClick={() => setScheduledOpen((o) => !o)}
                aria-expanded={scheduledOpen}
              >
                <ChevronRight className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-400">Scheduled (0)</span>
              </button>
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  )
}
