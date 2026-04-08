'use client'

import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  ClipboardList,
  AlertTriangle,
  Wrench,
  CheckCircle2,
  Plus,
  BarChart3,
  ShieldCheck,
  Download,
  FileText,
  RefreshCw,
  ChevronRight,
  Clock,
  User,
  MapPin,
} from 'lucide-react'
import { staggerContainer, fadeInUp, cardEntrance } from '@/lib/animations'
import AnimatedCounter from '@/components/motion/AnimatedCounter'
import CampusComparisonWidget from './CampusComparisonWidget'
import { fetchApi } from '@/lib/api-client'

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

const STATUS_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  BACKLOG: { dot: 'bg-slate-400', bg: 'bg-slate-50', text: 'text-slate-600' },
  TODO: { dot: 'bg-blue-400', bg: 'bg-blue-50', text: 'text-blue-700' },
  IN_PROGRESS: { dot: 'bg-amber-400', bg: 'bg-amber-50', text: 'text-amber-700' },
  ON_HOLD: { dot: 'bg-red-400', bg: 'bg-red-50', text: 'text-red-700' },
  SCHEDULED: { dot: 'bg-violet-400', bg: 'bg-violet-50', text: 'text-violet-700' },
  QA_REVIEW: { dot: 'bg-pink-400', bg: 'bg-pink-50', text: 'text-pink-700' },
}

const STATUS_LABELS: Record<string, string> = {
  BACKLOG: 'Backlog',
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'On Hold',
  SCHEDULED: 'Scheduled',
  QA_REVIEW: 'QA Review',
}

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

// ─── Main component ───────────────────────────────────────────────────────────

export default function MaintenanceDashboard({ activeCampusId }: MaintenanceDashboardProps) {
  const router = useRouter()

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

  const urgentCount = (byPriority['URGENT'] ?? 0) + (stats?.overdueCount ?? 0)
  const inProgressCount = byStatus['IN_PROGRESS'] ?? 0
  const doneCount = byStatus['DONE'] ?? 0

  const statCards = [
    {
      label: 'Open Tickets',
      value: openCount,
      icon: ClipboardList,
      accent: false,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50',
      onClick: () => goToWorkOrders(),
    },
    {
      label: 'Urgent / Overdue',
      value: urgentCount,
      icon: AlertTriangle,
      accent: true,
      iconColor: 'text-red-500',
      bgColor: 'bg-red-50',
      onClick: () => goToWorkOrders({ priority: 'URGENT' }),
    },
    {
      label: 'In Progress',
      value: inProgressCount,
      icon: Wrench,
      accent: false,
      iconColor: 'text-amber-500',
      bgColor: 'bg-amber-50',
      onClick: () => goToWorkOrders({ status: 'IN_PROGRESS' }),
    },
    {
      label: 'Completed (Total)',
      value: doneCount,
      icon: CheckCircle2,
      accent: false,
      iconColor: 'text-primary-500',
      bgColor: 'bg-primary-50',
      onClick: () => goToWorkOrders({ status: 'DONE' }),
    },
  ]

  // Needs Attention aggregation
  const overdueCount = stats?.overdueCount ?? 0
  const urgentPriorityCount = byPriority['URGENT'] ?? 0
  const unassignedCount = stats?.unassignedCount ?? 0
  const needsAttentionTotal = overdueCount + urgentPriorityCount + unassignedCount

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="ui-glass p-5 rounded-2xl">
              <div className="w-9 h-9 rounded-xl bg-slate-100 mb-3" />
              <div className="h-8 bg-slate-100 rounded w-16 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-24" />
            </div>
          ))}
        </div>
        <div className="ui-glass p-4 rounded-2xl h-12" />
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
      {/* Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon
          return (
            <motion.div
              key={card.label}
              variants={cardEntrance}
              custom={i}
              onClick={card.onClick}
              className={`cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.97] ${
                card.accent
                  ? 'bg-gradient-to-br from-red-50/80 to-red-100/80 backdrop-blur-sm border border-red-200/30 rounded-2xl p-5 shadow-sm'
                  : 'ui-glass p-5'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-xl ${card.bgColor} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${card.iconColor}`} />
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900 mb-1">
                <AnimatedCounter value={card.value} />
              </div>
              <p className="text-xs text-slate-500">{card.label}</p>
            </motion.div>
          )
        })}
      </div>

      {/* Quick Actions */}
      <motion.div variants={fadeInUp} className="ui-glass p-4 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => goToWorkOrders({ create: 'true' })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all duration-200 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Ticket
          </button>
          <button
            onClick={() => router.push('/maintenance/analytics')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 active:scale-[0.97] transition-all duration-200 cursor-pointer"
          >
            <BarChart3 className="w-4 h-4" />
            Analytics
          </button>
          <button
            onClick={() => router.push('/maintenance/compliance')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 active:scale-[0.97] transition-all duration-200 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            Compliance
          </button>
          <button
            onClick={() => {
              const params = new URLSearchParams()
              if (activeCampusId) params.set('schoolId', activeCampusId)
              const qs = params.toString()
              window.open(`/api/settings/export/tickets${qs ? `?${qs}` : ''}`, '_blank')
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 active:scale-[0.97] transition-all duration-200 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => router.push('/maintenance/board-report')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 active:scale-[0.97] transition-all duration-200 cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            Board Report
          </button>
        </div>
      </motion.div>

      {/* Two-column: Needs Attention + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Needs Attention */}
        <motion.div
          variants={fadeInUp}
          className={`rounded-2xl p-5 shadow-sm backdrop-blur-sm border ${
            needsAttentionTotal > 0
              ? 'bg-gradient-to-br from-red-50/80 to-red-100/80 border-red-200/30'
              : 'bg-gradient-to-br from-green-50/80 to-green-100/80 border-green-200/30'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
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
              {overdueCount > 0 && (
                <div
                  className="flex items-center gap-2 p-3 bg-white/60 rounded-xl cursor-pointer hover:bg-white/80 transition-colors"
                  onClick={() => goToWorkOrders({ priority: 'URGENT' })}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      {overdueCount} overdue ticket{overdueCount !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-slate-400">In backlog for over 48 hours</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                </div>
              )}
              {urgentPriorityCount > 0 && (
                <div
                  className="flex items-center gap-2 p-3 bg-white/60 rounded-xl cursor-pointer hover:bg-white/80 transition-colors"
                  onClick={() => goToWorkOrders({ priority: 'URGENT' })}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      {urgentPriorityCount} urgent ticket{urgentPriorityCount !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-slate-400">Marked as urgent priority</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                </div>
              )}
              {unassignedCount > 0 && (
                <div
                  className="flex items-center gap-2 p-3 bg-white/60 rounded-xl cursor-pointer hover:bg-white/80 transition-colors"
                  onClick={() => goToWorkOrders({ unassigned: 'true' })}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      {unassignedCount} unassigned ticket{unassignedCount !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-slate-400">Need a technician assigned</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-white/60 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              </div>
              <p className="text-sm font-medium text-green-700 mb-1">All clear</p>
              <p className="text-xs text-green-500 max-w-[200px] leading-relaxed">
                No overdue, urgent, or unassigned tickets right now.
              </p>
            </div>
          )}
        </motion.div>

        {/* Recent Activity */}
        <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800">Recent Activity</h3>
            <a
              href="/maintenance/work-orders"
              className="text-xs text-blue-500 hover:text-blue-700 transition-colors flex items-center gap-0.5"
            >
              View all
              <ChevronRight className="w-3 h-3" />
            </a>
          </div>

          {recentTickets.length > 0 ? (
            <div className="space-y-1">
              {recentTickets.map((ticket) => {
                const statusStyle = STATUS_COLORS[ticket.status] ?? STATUS_COLORS.BACKLOG
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
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
                <ClipboardList className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-500 mb-1">No active tickets</p>
              <p className="text-xs text-slate-400 max-w-[200px] leading-relaxed">
                Recent ticket activity will appear here.
              </p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Campus Comparison — only shown when viewing all campuses */}
      {!activeCampusId && (
        <CampusComparisonWidget
          data={stats?.byCampus ?? []}
          onCampusClick={(schoolId) => router.push(`/maintenance/work-orders?schoolId=${schoolId}`)}
        />
      )}
    </motion.div>
  )
}
