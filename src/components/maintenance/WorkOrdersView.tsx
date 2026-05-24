'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, LayoutGrid, List, Download, Plus } from 'lucide-react'
import { fetchApi, getAuthHeaders } from '@/lib/api-client'
import { useToast } from '@/components/Toast'
import { STATUS_LABELS } from '@/lib/constants/maintenance'
import { staggerContainer, fadeInUp, expandCollapse } from '@/lib/animations'
import { usePermissions } from '@/lib/hooks/usePermissions'
import { useAuth } from '@/lib/hooks/useAuth'
import { Checkbox } from '@/components/ui/Checkbox'
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
import dynamic from 'next/dynamic'

const KanbanBoard = dynamic(() => import('./KanbanBoard'), { ssr: false })

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Technician {
  id: string
  firstName: string
  lastName: string
}

interface WorkOrdersViewProps {
  schoolIdFilter: string  // '' = all campuses
  initialStatus?: string
  initialPriority?: string
  initialUnassigned?: boolean
  initialSchoolId?: string
  initialCategory?: string
  initialSearch?: string
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

export default function WorkOrdersView({ schoolIdFilter, initialStatus, initialPriority, initialUnassigned, initialSchoolId, initialCategory, initialSearch }: WorkOrdersViewProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { data: perms } = usePermissions()
  const { user: authUser } = useAuth()

  const canManage = perms?.canManageMaintenance ?? false
  const canClaim = perms?.canClaimMaintenance ?? false
  const canAssign = canManage
  const canChangeStatus = canManage || canClaim

  // Current user ID from useAuth hook (cookie-based)
  // IMPORTANT: must be declared before any useState that references it
  const currentUserId = authUser.id ?? ''

  // View mode: board (Kanban) or table — default to table when pre-filtered
  const hasInitialFilter = !!(initialStatus || initialPriority || initialUnassigned)
  const [viewMode, setViewMode] = useState<'board' | 'table'>(hasInitialFilter ? 'table' : 'board')

  // Scope: mine (my tickets + unassigned) vs all
  // Admins/managers default to "all" — they oversee the full board, not a personal queue.
  const defaultScope = canManage ? 'all' : 'mine'
  const [scope, setScope] = useState<'mine' | 'all'>(() => {
    if (typeof window === 'undefined') return defaultScope
    return (localStorage.getItem(`maint-scope:${currentUserId}`) as 'mine' | 'all') || defaultScope
  })
  const handleScopeChange = (s: 'mine' | 'all') => {
    setScope(s)
    if (currentUserId) localStorage.setItem(`maint-scope:${currentUserId}`, s)
  }

  // Filter state — merge URL-provided initial filters
  const [filters, setFilters] = useState<WorkOrdersFilterState>({
    ...DEFAULT_FILTERS,
    schoolId: initialSchoolId || schoolIdFilter,
    ...(initialStatus ? { status: initialStatus as WorkOrdersFilterState['status'] } : {}),
    ...(initialPriority ? { priority: initialPriority as WorkOrdersFilterState['priority'] } : {}),
    ...(initialCategory ? { category: initialCategory as WorkOrdersFilterState['category'] } : {}),
    ...(initialSearch ? { search: initialSearch } : {}),
    ...(initialUnassigned ? { unassigned: true } : {}),
  })

  // Sync schoolId filter when campus chip changes
  useEffect(() => {
    setFilters((prev) => ({ ...prev, schoolId: schoolIdFilter }))
  }, [schoolIdFilter])

  // Sync filter state to URL params (shallow, no navigation)
  const router = useRouter()
  const isFirstRender = useRef(true)
  useEffect(() => {
    // Skip on first render to avoid overwriting initial URL
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const params = new URLSearchParams()
    if (filters.status) params.set('status', filters.status)
    if (filters.priority) params.set('priority', filters.priority)
    if (filters.category) params.set('category', filters.category)
    if (filters.unassigned) params.set('unassigned', 'true')
    if (filters.search) params.set('q', filters.search)
    if (filters.schoolId && filters.schoolId !== schoolIdFilter) params.set('schoolId', filters.schoolId)
    const qs = params.toString()
    router.replace(`/maintenance/work-orders${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [filters.status, filters.priority, filters.category, filters.unassigned, filters.search]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sort state (default: priority desc, then age asc handled inside table)
  const [sort, setSort] = useState<SortState>({ field: 'priority', dir: 'desc' })

  // Specialty toggle (for technician view)
  const [showAll, setShowAll] = useState(false)

  // Scheduled section collapse state
  const [scheduledOpen, setScheduledOpen] = useState(false)

  // Track which ticket is being claimed (for optimistic UI)
  const [claimingId, setClaimingId] = useState<string | null>(null)

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
      >('/api/settings/users?teamSlug=maintenance')
      // Only show maintenance / facility team members as potential assignees
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
      await queryClient.cancelQueries({ queryKey: mainQueryKey })
      const snapshot = queryClient.getQueryData<WorkOrderTicket[]>(mainQueryKey)
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
      if (context?.snapshot) queryClient.setQueryData(mainQueryKey, context.snapshot)
    },
    onSettled: () => {
      setClaimingId(null)
      queryClient.invalidateQueries({ queryKey: ['maintenance-tickets'] })
      queryClient.invalidateQueries({ queryKey: mainQueryKey })
    },
  })

  // ─── Assign mutation ──────────────────────────────────────────────────────

  const assignMutation = useMutation({
    mutationFn: ({ ticketId, techId }: { ticketId: string; techId: string }) =>
      assignTicketApi(ticketId, techId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-tickets'] })
      queryClient.invalidateQueries({ queryKey: mainQueryKey })
    },
  })

  // ─── Status change mutation (with undo toast) ─────────────────────────────

  const statusMutation = useMutation({
    mutationFn: ({ ticketId, status, extra, previousStatus }: { ticketId: string; status: string; extra?: Record<string, string>; previousStatus?: string }) =>
      changeStatusApi(ticketId, status, extra),
    onSuccess: (_data, variables) => {
      const { ticketId, status, previousStatus } = variables
      const label = STATUS_LABELS[status] ?? status
      // Only offer undo for reversible transitions (not DONE/CANCELLED)
      if (previousStatus && status !== 'DONE' && status !== 'CANCELLED') {
        toast(`Status changed to ${label}`, 'success', {
          duration: 5000,
          action: {
            label: 'Undo',
            onClick: () => {
              changeStatusApi(ticketId, previousStatus).then(() => {
                queryClient.invalidateQueries({ queryKey: ['maintenance-tickets'] })
                queryClient.invalidateQueries({ queryKey: mainQueryKey })
                toast('Status reverted', 'info')
              }).catch(() => {
                toast('Failed to undo', 'error')
              })
            },
          },
        })
      } else {
        toast(`Status changed to ${label}`, 'success')
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-tickets'] })
      queryClient.invalidateQueries({ queryKey: mainQueryKey })
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
    let tickets = mainTickets
    // If user is not a tech or perms are admin, show all specialties
    if (canClaim && !canManage && !showAll) {
      tickets = tickets.filter((t) => t.matchesSpecialty !== false)
    }
    // Scope filter: "mine" shows full backlog (so techs can self-assign)
    // plus the tech's own assigned tickets in all other columns.
    if (scope === 'mine' && currentUserId) {
      tickets = tickets.filter((t) =>
        t.status === 'BACKLOG' || !t.assignedTo || t.assignedTo.id === currentUserId
      )
    }
    return tickets
  }, [mainTickets, canClaim, canManage, showAll, scope, currentUserId])()

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <motion.div
      className="space-y-4"
      initial="hidden"
      animate="visible"
      variants={staggerContainer(0.06, 0.04)}
    >
      {/* Controls row */}
      <motion.div variants={fadeInUp} className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {/* Specialty toggle — shown only for technicians (canClaim but not canManage) */}
          {canClaim && !canManage && (
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
              <Checkbox
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
              />
              Show all (including other specialties)
            </label>
          )}

          {viewMode === 'table' && (
            <span className="text-sm text-slate-500">
              {mainLoading
                ? 'Loading tickets...'
                : `${displayedTickets.length} ticket${displayedTickets.length !== 1 ? 's' : ''}`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
        {/* Scope toggle */}
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
          <button
            onClick={() => handleScopeChange('mine')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              scope === 'mine'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            My Queue
          </button>
          <button
            onClick={() => handleScopeChange('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              scope === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            All Tickets
          </button>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-slate-200" />

        {/* Board / Table toggle */}
        <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-lg">
          <button
            onClick={() => setViewMode('board')}
            title="Board view"
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              viewMode === 'board'
                ? 'bg-white shadow-sm text-slate-900'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            title="Table view"
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              viewMode === 'table'
                ? 'bg-white shadow-sm text-slate-900'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        {/* Divider */}
        <div className="w-px h-5 bg-slate-200" />

        {/* Export CSV */}
        <button
          onClick={() => {
            const params = new URLSearchParams()
            if (filters.schoolId) params.set('schoolId', filters.schoolId)
            if (filters.status) params.set('status', filters.status)
            if (filters.priority) params.set('priority', filters.priority)
            if (filters.category) params.set('category', filters.category)
            const qs = params.toString()
            window.open(`/api/settings/export/tickets${qs ? `?${qs}` : ''}`, '_blank')
          }}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Export filtered tickets as CSV"
        >
          <Download className="w-4 h-4" />
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
            technicians={technicians}
            currentUserId={currentUserId}
            canManage={canManage}
            canClaim={canClaim}
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
              onStatusChange={(ticketId, status, extra) => {
                const currentTicket = displayedTickets.find((t) => t.id === ticketId)
                statusMutation.mutate({ ticketId, status, extra, previousStatus: currentTicket?.status })
              }
              }
              claimingId={claimingId}
            />
          </motion.div>

          {/* Scheduled tickets collapsible section */}
          {scheduledTickets.length > 0 && (
            <motion.div variants={fadeInUp} className="ui-glass rounded-2xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer hover:bg-slate-50/50 transition-colors"
                onClick={() => setScheduledOpen((o) => !o)}
                aria-expanded={scheduledOpen}
              >
                <div className="flex items-center gap-2">
                  {scheduledOpen ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                  <span className="text-sm font-semibold text-slate-700">
                    Scheduled ({scheduledTickets.length})
                  </span>
                  <span className="text-xs text-slate-400">— sorted by scheduled date</span>
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
                    className="overflow-hidden border-t border-slate-100"
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
                className="w-full flex items-center gap-2 px-5 py-3 ui-glass rounded-2xl text-left cursor-pointer hover:bg-slate-50/50 transition-colors opacity-50"
                onClick={() => setScheduledOpen((o) => !o)}
                aria-expanded={scheduledOpen}
              >
                <ChevronRight className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-400">Scheduled (0)</span>
              </button>
            </motion.div>
          )}
        </>
      )}
      {/* Mobile FAB — quick ticket creation */}
      <button
        onClick={() => router.push('/maintenance/work-orders?create=true')}
        className="md:hidden fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-gray-900 text-white shadow-lg flex items-center justify-center hover:bg-gray-800 active:scale-95 transition-all cursor-pointer"
        aria-label="Create ticket"
      >
        <Plus className="w-6 h-6" />
      </button>
    </motion.div>
  )
}
