'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  ClipboardList,
  AlertTriangle,
  Wrench,
  CheckCircle2,
  Plus,
  RefreshCw,
  ChevronRight,
  Clock,
  User,
  MapPin,
  CalendarRange,
  CalendarClock,
  XCircle,
  Loader2,
  StickyNote,
  Monitor,
  Timer,
} from 'lucide-react'
import { Textarea } from '@/components/ui/Textarea'
import { staggerContainer, fadeInUp, cardEntrance } from '@/lib/animations'
import AnimatedCounter from '@/components/motion/AnimatedCounter'
import CampusComparisonWidget from './CampusComparisonWidget'
import TechnicianWorkloadWidget from './TechnicianWorkloadWidget'
import { fetchApi } from '@/lib/api-client'
import { usePendingGateApprovals, type EventProject } from '@/lib/hooks/useEventProject'
import { useToast } from '@/components/Toast'
import { readResourceItems } from '@/lib/utils/resourceItems'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CampusCount {
  schoolId: string
  schoolName: string
  count: number
}

interface RecentTicket {
  id: string
  title: string
  status: string
  priority: string
  updatedAt: string
  location: string | null
  assignedTo: { id: string; name: string } | null
}

interface DashboardStats {
  byStatus: Record<string, number>
  byPriority: Record<string, number>
  byCategory: Record<string, number>
  unassignedCount: number
  overdueCount: number
  avgResolutionHours: number | null
  byCampus?: CampusCount[]
  recentTickets?: RecentTicket[]
}

interface MaintenanceDashboardProps {
  activeCampusId: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

import { STATUS_DOT_COLORS, STATUS_LABELS } from '@/lib/constants/maintenance'

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  return `${weeks}w ago`
}

// ─── PM Summary Card ────────────────────────────────────────────────────────

interface PmCalendarEvent {
  id: string
  title: string
  start: string
  end: string
  assetName?: string | null
}

function PmSummaryCard() {
  const router = useRouter()

  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const { data: pmEvents } = useQuery<PmCalendarEvent[]>({
    queryKey: ['pm-summary-week', weekStart.toISOString()],
    queryFn: () =>
      fetchApi<PmCalendarEvent[]>(
        `/api/maintenance/pm-schedules?view=calendar&start=${weekStart.toISOString()}&end=${weekEnd.toISOString()}`
      ),
    staleTime: 5 * 60 * 1000,
  })

  const count = pmEvents?.length ?? 0
  if (count === 0) return null

  return (
    <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center">
            <CalendarClock className="w-4 h-4 text-slate-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">PM This Week</h3>
            <p className="text-xs text-slate-500">{count} task{count !== 1 ? 's' : ''} scheduled</p>
          </div>
        </div>
        <button
          onClick={() => router.push('/maintenance?tab=pm-calendar')}
          className="text-xs text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-0.5 cursor-pointer"
        >
          View calendar
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
      <div className="space-y-1">
        {pmEvents!.slice(0, 3).map((ev) => (
          <div
            key={ev.id}
            className="flex items-center gap-3 p-2 -mx-1 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-800 truncate" title={ev.title}>{ev.title}</p>
              {ev.assetName && (
                <p className="text-[10px] text-slate-400 truncate" title={ev.assetName}>{ev.assetName}</p>
              )}
            </div>
            <span className="text-[10px] text-slate-400 flex-shrink-0">
              {format(new Date(ev.start), 'EEE, MMM d')}
            </span>
          </div>
        ))}
        {count > 3 && (
          <button
            onClick={() => router.push('/maintenance?tab=pm-calendar')}
            className="w-full flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
          >
            +{count - 3} more this week
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ─── Facility Request Card ───────────────────────────────────────────────────

function FacilityRequestCard({
  project,
  onApprove,
  onReject,
  isProcessing,
}: {
  project: EventProject
  onApprove: (id: string) => void
  onReject: (id: string, reason: string) => void
  isProcessing: boolean
}) {
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const startsAt = new Date(project.startsAt)
  const endsAt = new Date(project.endsAt)
  const dateDisplay = project.isMultiDay
    ? `${format(startsAt, 'MMM d')} – ${format(endsAt, 'MMM d, yyyy')}`
    : format(startsAt, 'MMM d, yyyy')

  const creatorName = project.createdBy?.firstName
    ? `${project.createdBy.firstName} ${project.createdBy.lastName || ''}`.trim()
    : project.createdBy?.email

  const meta = (project.metadata ?? {}) as Record<string, unknown>
  const facilityNeeds = readResourceItems(meta, 'facilityNeeds').map((i) => i.name)
  const facilityNotes = (meta.facilityNotes ?? '') as string
  const avNeeds = readResourceItems(meta, 'avNeeds').map((i) => i.name)
  const avNotes = (meta.avNotes ?? '') as string

  const handleReject = () => {
    if (!rejectReason.trim()) return
    onReject(project.id, rejectReason.trim())
    setShowRejectForm(false)
    setRejectReason('')
  }

  return (
    <div className="p-4 bg-white/60 rounded-xl hover:bg-white/80 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <h4 className="text-sm font-semibold text-slate-900 truncate flex-1 min-w-0">
          {project.title}
        </h4>
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
        <span className="inline-flex items-center gap-1">
          <CalendarRange className="w-3 h-3" />
          {dateDisplay}
        </span>
        {project.locationText && (
          <span className="inline-flex items-center gap-1 truncate max-w-[140px]">
            <MapPin className="w-3 h-3" />
            {project.locationText}
          </span>
        )}
      </div>

      {creatorName && (
        <p className="text-xs text-slate-400 mb-2">Submitted by {creatorName}</p>
      )}

      {/* Facility needs */}
      {(facilityNeeds.length > 0 || facilityNotes) && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          {facilityNeeds.map((need) => (
            <span
              key={need}
              className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium"
            >
              {need}
            </span>
          ))}
          {facilityNotes && (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600">
              <StickyNote className="w-2.5 h-2.5" />
              {facilityNotes.length > 60 ? `${facilityNotes.slice(0, 60)}...` : facilityNotes}
            </span>
          )}
        </div>
      )}

      {/* AV needs (if also present) */}
      {project.requiresAV && (avNeeds.length > 0 || avNotes) && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          <Monitor className="w-3 h-3 text-blue-500" />
          {avNeeds.map((need) => (
            <span
              key={need}
              className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-medium"
            >
              {need}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      {!showRejectForm ? (
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => onApprove(project.id)}
            disabled={isProcessing}
            aria-busy={isProcessing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-green-600 text-white text-xs font-medium hover:bg-green-700 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            Approve
          </button>
          <button
            onClick={() => setShowRejectForm(true)}
            disabled={isProcessing}
            aria-busy={isProcessing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50"
          >
            <XCircle className="w-3.5 h-3.5" />
            Reject
          </button>
        </div>
      ) : (
        <div className="space-y-2 mt-3">
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection (required)..."
            className="w-full text-sm focus:ring-red-300 focus:border-red-400 resize-none"
            rows={2}
            autoFocus
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleReject}
              disabled={!rejectReason.trim() || isProcessing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-red-600 text-white text-xs font-medium hover:bg-red-700 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm Rejection'}
            </button>
            <button
              onClick={() => { setShowRejectForm(false); setRejectReason('') }}
              className="px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MaintenanceDashboard({ activeCampusId }: MaintenanceDashboardProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

  // Fetch pending facility approval requests
  const { data: pendingRequests } = usePendingGateApprovals('facilities')
  const facilityRequestCount = pendingRequests?.length ?? 0

  const handleApproveRequest = async (projectId: string) => {
    setProcessingIds((prev) => new Set(prev).add(projectId))
    try {
      const res = await fetch(`/api/events/projects/${projectId}/approve-gate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gateType: 'facilities' }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err?.error?.message || 'Failed to approve')
      }
      toast('Facility request approved', 'success')
      window.dispatchEvent(new Event('focus'))
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to approve', 'error')
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(projectId)
        return next
      })
    }
  }

  const handleRejectRequest = async (projectId: string, reason: string) => {
    setProcessingIds((prev) => new Set(prev).add(projectId))
    try {
      const res = await fetch(`/api/events/projects/${projectId}/reject-gate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gateType: 'facilities', reason }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err?.error?.message || 'Failed to reject')
      }
      toast('Event sent back for revision', 'success')
      window.dispatchEvent(new Event('focus'))
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to reject', 'error')
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(projectId)
        return next
      })
    }
  }

  const goToWorkOrders = (params?: Record<string, string>) => {
    const qs = new URLSearchParams(params)
    if (activeCampusId) qs.set('schoolId', activeCampusId)
    const query = qs.toString()
    router.push(`/maintenance/work-orders${query ? `?${query}` : ''}`)
  }

  const { data: stats, isLoading, isError, refetch } = useQuery<DashboardStats>({
    queryKey: ['maintenance-dashboard', activeCampusId ?? 'all'],
    queryFn: async () => {
      const qs = activeCampusId ? `?schoolId=${activeCampusId}` : ''
      return fetchApi<DashboardStats>(`/api/maintenance/dashboard${qs}`)
    },
    staleTime: 2 * 60 * 1000,
  })

  // Derive aggregate counts
  const byStatus = stats?.byStatus ?? {}
  const byPriority = stats?.byPriority ?? {}

  const openCount = Object.entries(byStatus)
    .filter(([k]) => k !== 'DONE' && k !== 'CANCELLED')
    .reduce((sum, [, v]) => sum + v, 0)

  const urgentPriorityOnly = byPriority['URGENT'] ?? 0
  const overdueOnly = stats?.overdueCount ?? 0
  const inProgressCount = byStatus['IN_PROGRESS'] ?? 0
  const doneCount = byStatus['DONE'] ?? 0
  const totalTickets = openCount + doneCount + (byStatus['CANCELLED'] ?? 0)

  const statCards = [
    {
      label: 'Open Tickets',
      value: openCount,
      icon: ClipboardList,
      onClick: () => goToWorkOrders(),
    },
    {
      label: 'Urgent',
      value: urgentPriorityOnly,
      icon: AlertTriangle,
      onClick: () => goToWorkOrders({ priority: 'URGENT' }),
    },
    {
      label: 'Overdue',
      value: overdueOnly,
      icon: Timer,
      onClick: () => goToWorkOrders({ priority: 'URGENT' }),
    },
    {
      label: 'In Progress',
      value: inProgressCount,
      icon: Wrench,
      onClick: () => goToWorkOrders({ status: 'IN_PROGRESS' }),
    },
    {
      label: 'Resolved',
      value: doneCount,
      icon: CheckCircle2,
      onClick: () => goToWorkOrders({ status: 'DONE' }),
    },
  ]

  // Needs Attention aggregation
  const unassignedCount = stats?.unassignedCount ?? 0
  const needsAttentionTotal = overdueOnly + urgentPriorityOnly + unassignedCount

  const recentTickets = stats?.recentTickets ?? []

  // ─── Error state ─────────────────────────────────────────────────────────

  if (isError) {
    return (
      <div className="ui-glass rounded-2xl p-10 flex flex-col items-center justify-center text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mb-3" />
        <p className="text-sm font-medium text-slate-600 mb-1">Unable to load dashboard data</p>
        <p className="text-xs text-slate-400 mb-4">Check your connection and try again.</p>
        <button
          onClick={() => refetch()}
          className="ui-btn-sm ui-btn-primary"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    )
  }

  // ─── Loading skeleton ──────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="ui-glass p-5 rounded-2xl">
              <div className="w-9 h-9 rounded-xl bg-slate-100 mb-3" />
              <div className="h-8 bg-slate-100 rounded w-16 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-24" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="ui-glass p-5 rounded-2xl h-52" />
          <div className="ui-glass p-5 rounded-2xl h-52" />
        </div>
      </div>
    )
  }

  // ─── Loaded state ──────────────────────────────────────────────────────

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={staggerContainer(0.06, 0.04)}
    >
      {/* ─── Two-column layout: Main (2/3) + Sidebar (1/3) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Left column (2/3) ─── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Facility Requests — always on top when present */}
          {facilityRequestCount > 0 && (
            <motion.div
              variants={fadeInUp}
              className="rounded-2xl p-5 shadow-sm backdrop-blur-sm border bg-gradient-to-br from-amber-50/80 to-amber-100/80 border-amber-200/30"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-800">Facility Requests</h3>
                  <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold leading-none">
                    {facilityRequestCount}
                  </span>
                </div>
                <span className="text-xs text-amber-600">
                  Events requesting facilities support
                </span>
              </div>

              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {pendingRequests!.slice(0, 3).map((project) => (
                    <motion.div
                      key={project.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                    >
                      <FacilityRequestCard
                        project={project}
                        onApprove={handleApproveRequest}
                        onReject={handleRejectRequest}
                        isProcessing={processingIds.has(project.id)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
                {facilityRequestCount > 3 && (
                  <button
                    onClick={() => router.push('/maintenance/event-approvals')}
                    className="w-full flex items-center justify-center gap-1 py-2 text-xs font-medium text-amber-700 hover:text-amber-900 transition-colors cursor-pointer"
                  >
                    View all {facilityRequestCount} requests
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* Stat Cards or Empty State */}
          {totalTickets === 0 ? (
            <motion.div variants={fadeInUp} className="ui-glass p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                <ClipboardList className="w-7 h-7 text-slate-300" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-1">No maintenance tickets yet</h3>
              <p className="text-sm text-slate-500 mb-5 max-w-sm mx-auto">
                Create your first ticket to start tracking work orders, assignments, and resolution times.
              </p>
              <button
                onClick={() => goToWorkOrders({ create: 'true' })}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all duration-200 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Create First Ticket
              </button>
            </motion.div>
          ) : (
            <>
              {/* Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {statCards.map((card, i) => {
                  const Icon = card.icon
                  return (
                    <motion.div
                      key={card.label}
                      variants={cardEntrance}
                      custom={i}
                      onClick={card.onClick}
                      className="ui-glass p-4 cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.97]"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                          <Icon className="w-4 h-4 text-slate-500" />
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-slate-900 mb-0.5">
                        <AnimatedCounter value={card.value} />
                      </div>
                      <p className="text-[11px] text-slate-500">{card.label}</p>
                    </motion.div>
                  )
                })}
              </div>

              {/* Needs Attention */}
              <motion.div
                variants={fadeInUp}
                className={`rounded-2xl p-5 shadow-sm backdrop-blur-sm border ${
                  needsAttentionTotal > 0
                    ? 'bg-gradient-to-br from-red-50/80 to-red-100/80 border-red-200/30'
                    : 'bg-gradient-to-br from-green-50/80 to-green-100/80 border-green-200/30'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-800">Needs Attention</h3>
                    {needsAttentionTotal > 0 && (
                      <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                        {needsAttentionTotal}
                      </span>
                    )}
                  </div>
                  {needsAttentionTotal > 0 && (
                    <a
                      href="/maintenance/work-orders?priority=URGENT"
                      className="text-xs text-red-500 hover:text-red-700 transition-colors flex items-center gap-0.5"
                    >
                      View all
                      <ChevronRight className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {needsAttentionTotal > 0 ? (
                  <div className="space-y-2">
                    {overdueOnly > 0 && (
                      <div
                        className="flex items-center gap-2 p-3 bg-white/60 rounded-xl cursor-pointer hover:bg-white/80 transition-colors"
                        onClick={() => goToWorkOrders({ priority: 'URGENT' })}
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800">
                            {overdueOnly} overdue ticket{overdueOnly !== 1 ? 's' : ''}
                          </p>
                          {recentTickets.filter((t) => t.status === 'BACKLOG').slice(0, 2).map((t) => (
                            <p key={t.id} className="text-xs text-slate-400 truncate" title={t.title}>{t.title}</p>
                          ))}
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                      </div>
                    )}
                    {urgentPriorityOnly > 0 && (
                      <div
                        className="flex items-center gap-2 p-3 bg-white/60 rounded-xl cursor-pointer hover:bg-white/80 transition-colors"
                        onClick={() => goToWorkOrders({ priority: 'URGENT' })}
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-orange-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800">
                            {urgentPriorityOnly} urgent ticket{urgentPriorityOnly !== 1 ? 's' : ''}
                          </p>
                          {recentTickets.filter((t) => t.priority === 'URGENT').slice(0, 2).map((t) => (
                            <p key={t.id} className="text-xs text-slate-400 truncate" title={t.title}>{t.title}</p>
                          ))}
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                      </div>
                    )}
                    {unassignedCount > 0 && (
                      <div
                        className="flex items-center gap-2 p-3 bg-white/60 rounded-xl cursor-pointer hover:bg-white/80 transition-colors"
                        onClick={() => goToWorkOrders({ unassigned: 'true' })}
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800">
                            {unassignedCount} unassigned ticket{unassignedCount !== 1 ? 's' : ''}
                          </p>
                          {recentTickets.filter((t) => !t.assignedTo).slice(0, 2).map((t) => (
                            <p key={t.id} className="text-xs text-slate-400 truncate" title={t.title}>{t.title}</p>
                          ))}
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 py-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-green-700">All clear</p>
                      <p className="text-xs text-green-500">No overdue, urgent, or unassigned tickets.</p>
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Recent Activity */}
              <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-800">Recent Activity</h3>
                  <a
                    href="/maintenance/work-orders"
                    className="text-xs text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-0.5"
                  >
                    View all
                    <ChevronRight className="w-3 h-3" />
                  </a>
                </div>

                {recentTickets.length > 0 ? (
                  <div className="space-y-1">
                    {recentTickets.map((ticket) => {
                      const statusStyle = STATUS_DOT_COLORS[ticket.status] ?? STATUS_DOT_COLORS.BACKLOG
                      return (
                        <div
                          key={ticket.id}
                          className="flex items-start gap-3 p-2.5 -mx-1 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors"
                          onClick={() => router.push(`/maintenance/work-orders?ticket=${ticket.id}`)}
                        >
                          <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${statusStyle.dot}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{ticket.title}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                                {STATUS_LABELS[ticket.status] ?? ticket.status}
                              </span>
                              {ticket.location && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400">
                                  <MapPin className="w-2.5 h-2.5" />
                                  {ticket.location}
                                </span>
                              )}
                              {ticket.assignedTo && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400">
                                  <User className="w-2.5 h-2.5" />
                                  {ticket.assignedTo.name}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 flex-shrink-0 mt-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {timeAgo(ticket.updatedAt)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 py-4">
                    <ClipboardList className="w-5 h-5 text-slate-300 flex-shrink-0" />
                    <p className="text-sm text-slate-400">Recent ticket activity will appear here.</p>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </div>

        {/* ─── Right column (1/3) ─── */}
        <div className="space-y-4">
          {/* Quick links */}
          <motion.div variants={fadeInUp} className="ui-glass p-4 rounded-2xl space-y-1">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-2 mb-2">Quick Access</h3>
            <button
              onClick={() => router.push('/maintenance/knowledge-base')}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
                <ClipboardList className="w-4 h-4 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 text-sm">Knowledge Base</p>
                <p className="text-[11px] text-slate-400">Guides, SOPs, and articles</p>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
            </button>
            <button
              onClick={() => router.push('/maintenance/assets')}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
                <Wrench className="w-4 h-4 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 text-sm">Asset Register</p>
                <p className="text-[11px] text-slate-400">Track equipment and facilities</p>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
            </button>
          </motion.div>

          {/* PM Summary */}
          <PmSummaryCard />

          {/* Technician Workload */}
          <TechnicianWorkloadWidget />

          {/* Campus Comparison */}
          {!activeCampusId && (
            <CampusComparisonWidget
              data={stats?.byCampus ?? []}
              onCampusClick={(schoolId) => router.push(`/maintenance/work-orders?schoolId=${schoolId}`)}
            />
          )}
        </div>
      </div>
    </motion.div>
  )
}
