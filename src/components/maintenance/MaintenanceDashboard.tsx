'use client'

import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
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
} from 'lucide-react'
import { staggerContainer, fadeInUp, cardEntrance } from '@/lib/animations'
import AnimatedCounter from '@/components/motion/AnimatedCounter'
import { fetchApi } from '@/lib/api-client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  byStatus: Record<string, number>
  byPriority: Record<string, number>
  byCategory: Record<string, number>
  unassignedCount: number
  overdueCount: number
  avgResolutionHours: number | null
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
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-gray-300" />
      </div>
      <p className="text-sm font-medium text-gray-500 mb-1">{heading}</p>
      <p className="text-xs text-gray-400 max-w-[200px] leading-relaxed">{description}</p>
    </div>
  )
}

function PanelHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      <span className="text-xs text-gray-300 cursor-not-allowed">View all</span>
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
    },
    {
      label: 'Urgent / Overdue',
      value: urgentCount,
      icon: AlertTriangle,
      accent: true,
      iconColor: 'text-red-500',
      bgColor: 'bg-red-50',
    },
    {
      label: 'In Progress',
      value: inProgressCount,
      icon: Wrench,
      accent: false,
      iconColor: 'text-amber-500',
      bgColor: 'bg-amber-50',
    },
    {
      label: 'Completed (Total)',
      value: doneCount,
      icon: CheckCircle2,
      accent: false,
      iconColor: 'text-primary-500',
      bgColor: 'bg-primary-50',
    },
  ]

  // Max count for status bar chart normalization
  const maxStatusCount = Math.max(1, ...Object.values(byStatus))

  // ─── Error state ─────────────────────────────────────────────────────────

  if (isError) {
    return (
      <div className="ui-glass rounded-2xl p-10 flex flex-col items-center justify-center text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mb-3" />
        <p className="text-sm font-medium text-gray-600 mb-1">Unable to load dashboard data</p>
        <p className="text-xs text-gray-400 mb-4">Check your connection and try again.</p>
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
              <div className="w-9 h-9 rounded-xl bg-gray-100 mb-3" />
              <div className="h-8 bg-gray-100 rounded w-16 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-24" />
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
      {/* Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon
          return (
            <motion.div
              key={card.label}
              variants={cardEntrance}
              custom={i}
              className={
                card.accent
                  ? 'bg-gradient-to-br from-red-50/80 to-red-100/80 backdrop-blur-sm border border-red-200/30 rounded-2xl p-5 shadow-sm'
                  : 'ui-glass p-5'
              }
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-xl ${card.bgColor} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${card.iconColor}`} />
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                <AnimatedCounter value={card.value} />
              </div>
              <p className="text-xs text-gray-500">{card.label}</p>
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
            <PanelHeader title="Tickets by Status" />
            <div className="space-y-2.5">
              {TICKET_STATUSES.map((status) => {
                const count = byStatus[status.key] ?? 0
                const pct = Math.round((count / maxStatusCount) * 100)
                return (
                  <div key={status.label} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-20 flex-shrink-0">{status.label}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: status.color }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-5 text-right flex-shrink-0">
                      {count}
                    </span>
                  </div>
                )
              })}
            </div>
          </motion.div>

          {/* Avg Resolution Time */}
          <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl">
            <PanelHeader title="Avg. Resolution Time" />
            {stats?.avgResolutionHours !== null ? (
              <div className="flex items-center gap-3 py-2">
                <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-primary-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatResolutionTime(stats?.avgResolutionHours ?? null)}
                  </p>
                  <p className="text-xs text-gray-400">average across completed tickets</p>
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

          {/* Campus Breakdown */}
          <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl">
            <PanelHeader title="Campus Breakdown" />
            <div className="text-xs text-gray-400 text-center py-4">No campus data available</div>
          </motion.div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Urgent / Overdue Alerts */}
          <motion.div
            variants={fadeInUp}
            className="bg-gradient-to-br from-red-50/80 to-red-100/80 backdrop-blur-sm border border-red-200/30 rounded-2xl p-5 shadow-sm"
          >
            <PanelHeader title="Urgent / Overdue Alerts" />
            {urgentCount > 0 ? (
              <div className="space-y-2">
                {(stats?.overdueCount ?? 0) > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-white/60 rounded-xl">
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-red-700">
                        {stats?.overdueCount} overdue ticket{(stats?.overdueCount ?? 0) !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-red-400">In backlog for over 48 hours unassigned</p>
                    </div>
                  </div>
                )}
                {(byPriority['URGENT'] ?? 0) > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-white/60 rounded-xl">
                    <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-red-700">
                        {byPriority['URGENT']} urgent ticket{(byPriority['URGENT'] ?? 0) !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-red-400">Marked as urgent priority</p>
                    </div>
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
            <PanelHeader title="Unassigned Tickets" />
            {(stats?.unassignedCount ?? 0) > 0 ? (
              <div className="flex items-center gap-3 py-2">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
                  <Wrench className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    <AnimatedCounter value={stats?.unassignedCount ?? 0} />
                  </p>
                  <p className="text-xs text-gray-400">tickets need a technician</p>
                </div>
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
