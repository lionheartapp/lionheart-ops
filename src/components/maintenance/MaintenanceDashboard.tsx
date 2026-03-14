'use client'

import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  ClipboardList,
  AlertTriangle,
  Wrench,
  CheckCircle2,
  Clock,
  ShieldCheck,
  CalendarClock,
  DollarSign,
  RefreshCw,
  Download,
  ChevronRight,
} from 'lucide-react'
import { staggerContainer, fadeInUp, cardEntrance } from '@/lib/animations'
import AnimatedCounter from '@/components/motion/AnimatedCounter'
import CampusComparisonWidget from './CampusComparisonWidget'
import { fetchApi } from '@/lib/api-client'
import { IllustrationMaintenance } from '@/components/illustrations'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CampusCount {
  schoolId: string
  schoolName: string
  count: number
}

interface DashboardStats {
  byStatus: Record<string, number>
  byPriority: Record<string, number>
  byCategory: Record<string, number>
  unassignedCount: number
  overdueCount: number
  avgResolutionHours: number | null
  byCampus?: CampusCount[]
}

interface MaintenanceDashboardProps {
  activeCampusId: string | null
}

// ─── Status bar chart config ──────────────────────────────────────────────────

const TICKET_STATUSES = [
  { label: 'Backlog', key: 'BACKLOG', color: '#64748b' },
  { label: 'To Do', key: 'TODO', color: '#3b82f6' },
  { label: 'In Progress', key: 'IN_PROGRESS', color: '#f59e0b' },
  { label: 'On Hold', key: 'ON_HOLD', color: '#ef4444' },
  { label: 'Scheduled', key: 'SCHEDULED', color: '#8b5cf6' },
  { label: 'QA Review', key: 'QA_REVIEW', color: '#ec4899' },
  { label: 'Done', key: 'DONE', color: '#22c55e' },
  { label: 'Cancelled', key: 'CANCELLED', color: '#94a3b8' },
]

// ─── Helper components ────────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  heading,
  description,
}: {
  icon: typeof Clock
  heading: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <IllustrationMaintenance className="w-40 h-32 mb-2" />
      <p className="text-sm font-medium text-slate-500 mb-1">{heading}</p>
      <p className="text-xs text-slate-400 max-w-[200px] leading-relaxed">{description}</p>
    </div>
  )
}

function PanelHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {href ? (
        <a
          href={href}
          className="text-xs text-blue-500 hover:text-blue-700 transition-colors flex items-center gap-0.5"
        >
          View all
          <ChevronRight className="w-3 h-3" />
        </a>
      ) : (
        <span className="text-xs text-slate-300">—</span>
      )}
    </div>
  )
}

function formatResolutionTime(hours: number | null): string {
  if (hours === null) return '—'
  if (hours < 24) return `${Math.round(hours)}h`
  const days = Math.round(hours / 24)
  return `${days}d`
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MaintenanceDashboard({ activeCampusId }: MaintenanceDashboardProps) {
  const router = useRouter()

  // Navigate to work orders with filter query params
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

  // Derive aggregate counts from live data
  const byStatus = stats?.byStatus ?? {}
  const byPriority = stats?.byPriority ?? {}

  // Open = all non-DONE, non-CANCELLED statuses
  const openCount = Object.entries(byStatus)
    .filter(([k]) => k !== 'DONE' && k !== 'CANCELLED')
    .reduce((sum, [, v]) => sum + v, 0)

  // Urgent/Overdue = URGENT priority active tickets + overdueCount
  const urgentCount = (byPriority['URGENT'] ?? 0) + (stats?.overdueCount ?? 0)

  // In Progress
  const inProgressCount = byStatus['IN_PROGRESS'] ?? 0

  // Done this month — the API returns total Done; approximate with Done count
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

  // Max count for status bar chart normalization
  const maxStatusCount = Math.max(1, ...Object.values(byStatus))

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

  // ─── Loading skeleton ────────────────────────────────────────────────────

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="ui-glass p-5 rounded-2xl h-48" />
          <div className="ui-glass p-5 rounded-2xl h-48" />
        </div>
      </div>
    )
  }

  // ─── Loaded state ────────────────────────────────────────────────────────

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={staggerContainer(0.06, 0.04)}
    >
      {/* Export CSV button */}
      <motion.div variants={fadeInUp} className="flex justify-end">
        <button
          onClick={() => {
            const params = new URLSearchParams()
            if (activeCampusId) params.set('schoolId', activeCampusId)
            const qs = params.toString()
            window.open(`/api/settings/export/tickets${qs ? `?${qs}` : ''}`, '_blank')
          }}
          className="px-4 py-2 rounded-full border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 active:scale-[0.97] transition-colors duration-200 flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </motion.div>

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

      {/* Two-column panel grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-4">
          {/* Tickets by Status */}
          <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl">
            <PanelHeader title="Tickets by Status" href="/maintenance/work-orders" />
            <div className="space-y-2.5">
              {TICKET_STATUSES.map((status) => {
                const count = byStatus[status.key] ?? 0
                const pct = Math.round((count / maxStatusCount) * 100)
                return (
                  <div
                    key={status.label}
                    className="flex items-center gap-3 cursor-pointer rounded-lg px-1 -mx-1 py-0.5 hover:bg-slate-50 transition-colors"
                    onClick={() => goToWorkOrders({ status: status.key })}
                  >
                    <span className="text-xs text-slate-500 w-20 flex-shrink-0">{status.label}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: status.color }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 w-5 text-right flex-shrink-0">
                      {count}
                    </span>
                  </div>
                )
              })}
            </div>
          </motion.div>

          {/* Avg Resolution Time */}
          <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl">
            <PanelHeader title="Avg. Resolution Time" href="/maintenance/work-orders?status=DONE" />
            {stats?.avgResolutionHours !== null ? (
              <div className="flex items-center gap-3 py-2">
                <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-primary-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">
                    {formatResolutionTime(stats?.avgResolutionHours ?? null)}
                  </p>
                  <p className="text-xs text-slate-400">average across completed tickets</p>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Clock}
                heading="No completed tickets yet"
                description="Resolution time will be tracked once tickets are marked done."
              />
            )}
          </motion.div>

          {/* Campus Comparison — only shown when viewing all campuses */}
          {!activeCampusId && (
            <CampusComparisonWidget
              data={stats?.byCampus ?? []}
              onCampusClick={(schoolId) => router.push(`/maintenance/work-orders?schoolId=${schoolId}`)}
            />
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Urgent / Overdue Alerts */}
          <motion.div
            variants={fadeInUp}
            className="bg-gradient-to-br from-red-50/80 to-red-100/80 backdrop-blur-sm border border-red-200/30 rounded-2xl p-5 shadow-sm"
          >
            <PanelHeader title="Urgent / Overdue Alerts" href="/maintenance/work-orders?priority=URGENT" />
            {urgentCount > 0 ? (
              <div className="space-y-2">
                {(stats?.overdueCount ?? 0) > 0 && (
                  <div
                    className="flex items-center gap-2 p-3 bg-white/60 rounded-xl cursor-pointer hover:bg-white/80 transition-colors"
                    onClick={() => goToWorkOrders({ priority: 'URGENT' })}
                  >
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-700">
                        {stats?.overdueCount} overdue ticket{(stats?.overdueCount ?? 0) !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-red-400">In backlog for over 48 hours unassigned</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-red-300 flex-shrink-0" />
                  </div>
                )}
                {(byPriority['URGENT'] ?? 0) > 0 && (
                  <div
                    className="flex items-center gap-2 p-3 bg-white/60 rounded-xl cursor-pointer hover:bg-white/80 transition-colors"
                    onClick={() => goToWorkOrders({ priority: 'URGENT' })}
                  >
                    <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-700">
                        {byPriority['URGENT']} urgent ticket{(byPriority['URGENT'] ?? 0) !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-red-400">Marked as urgent priority</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-red-300 flex-shrink-0" />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-white/60 flex items-center justify-center mb-3">
                  <ShieldCheck className="w-6 h-6 text-red-300" />
                </div>
                <p className="text-sm font-medium text-red-700 mb-1">No urgent alerts</p>
                <p className="text-xs text-red-400 max-w-[180px] leading-relaxed">
                  Overdue and high-priority tickets will appear here.
                </p>
              </div>
            )}
          </motion.div>

          {/* Unassigned Count */}
          <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl">
            <PanelHeader title="Unassigned Tickets" href="/maintenance/work-orders?unassigned=true" />
            {(stats?.unassignedCount ?? 0) > 0 ? (
              <div
                className="flex items-center gap-3 py-2 cursor-pointer rounded-xl hover:bg-slate-50 px-2 -mx-2 transition-colors"
                onClick={() => goToWorkOrders({ unassigned: 'true' })}
              >
                <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
                  <Wrench className="w-6 h-6 text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold text-slate-900">
                    <AnimatedCounter value={stats?.unassignedCount ?? 0} />
                  </p>
                  <p className="text-xs text-slate-400">tickets need a technician</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
              </div>
            ) : (
              <EmptyState
                icon={CheckCircle2}
                heading="All assigned"
                description="No unassigned active tickets — great work!"
              />
            )}
          </motion.div>

          {/* PM Calendar Preview */}
          <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl">
            <PanelHeader title="PM Calendar Preview" />
            {/* No href — PM not yet implemented */}
            <EmptyState
              icon={CalendarClock}
              heading="No PM schedules configured"
              description="Preventive maintenance schedules will appear here once configured."
            />
          </motion.div>
        </div>
      </div>

      {/* Full-width bottom row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Cost Summary */}
        <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl">
          <PanelHeader title="Cost Summary" />
          <EmptyState
            icon={DollarSign}
            heading="No cost data yet"
            description="Labor and material costs will be tracked here once tickets are completed."
          />
        </motion.div>

        {/* Compliance Status */}
        <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl">
          <PanelHeader title="Compliance Status" />
          <EmptyState
            icon={ShieldCheck}
            heading="No compliance domains configured"
            description="Compliance tracking domains will appear here once configured."
          />
        </motion.div>
      </div>
    </motion.div>
  )
}
