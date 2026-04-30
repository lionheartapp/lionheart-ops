'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { queryOptions } from '@/lib/queries'
import { staggerContainer, fadeInUp, cardEntrance } from '@/lib/animations'
import AnimatedCounter from '@/components/motion/AnimatedCounter'
import { DashboardSkeleton } from './ITSkeleton'
import ITERateWidget from './ITERateWidget'
import { useITPermissions } from '@/lib/hooks/useITPermissions'
import {
  Monitor,
  AlertTriangle,
  Wrench,
  CheckCircle2,
  PauseCircle,
  UserX,
  Plus,
  RefreshCw,
  ChevronRight,
  Clock,
  User,
  MapPin,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ITDashboardProps {
  onViewTicket: (ticketId: string) => void
  onCreateTicket: () => void
  /** School-scoped viewpoint. null = "All Schools". */
  activeSchoolId?: string | null
}

interface RecentTicket {
  id: string
  ticketNumber: string
  title: string
  status: string
  priority: string
  issueType: string
  updatedAt: string
  location: string | null
  assignedTo: { id: string; name: string } | null
}

interface DashboardStats {
  total: number
  open: number
  inProgress: number
  onHold: number
  urgent: number
  recentDone: number
  unassignedCount: number
  avgResolutionHours: number | null
  byStatus: Record<string, number>
  byIssueType: Record<string, number>
  byPriority: Record<string, number>
  bySource: Record<string, number>
  onHoldByReason: Record<string, number>
  recentActivity: Array<{
    id: string
    ticketId: string
    type: string
    content: string | null
    createdAt: string
    ticketNumber: string
    ticketTitle: string
    actorName: string | null
  }>
  recentTickets?: RecentTicket[]
}

// ─── Config ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  BACKLOG: { dot: 'bg-slate-400', bg: 'bg-slate-50', text: 'text-slate-600' },
  TODO: { dot: 'bg-blue-400', bg: 'bg-blue-50', text: 'text-blue-700' },
  IN_PROGRESS: { dot: 'bg-amber-400', bg: 'bg-amber-50', text: 'text-amber-700' },
  ON_HOLD: { dot: 'bg-red-400', bg: 'bg-red-50', text: 'text-red-700' },
}

const STATUS_LABELS: Record<string, string> = {
  BACKLOG: 'Backlog',
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'On Hold',
}

const HOLD_REASON_LABELS: Record<string, string> = {
  PARTS: 'Waiting on parts',
  VENDOR: 'Waiting on vendor',
  USER_AVAILABILITY: 'User availability',
  THIRD_PARTY: 'Third party',
  OTHER: 'Other',
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

// ─── Main component ──────────────────────────────────────────────────────────

export default function ITDashboard({ onViewTicket, onCreateTicket, activeSchoolId }: ITDashboardProps) {
  const router = useRouter()
  const itPerms = useITPermissions()
  const { data: stats, isLoading, isError, refetch } = useQuery(queryOptions.itDashboard(activeSchoolId ?? undefined))

  if (isError) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 flex flex-col items-center justify-center text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mb-3" />
        <p className="text-sm font-medium text-slate-600 mb-1">Unable to load dashboard data</p>
        <p className="text-xs text-slate-400 mb-4">Check your connection and try again.</p>
        <button
          onClick={() => refetch()}
          className="px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all inline-flex items-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    )
  }

  if (isLoading) return <DashboardSkeleton />

  const d = (stats ?? {}) as DashboardStats

  // ─── Stat cards ──────────────────────────────────────────────────────

  const statCards = [
    {
      label: 'Open',
      value: d.open ?? 0,
      icon: Monitor,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50',
      accent: false,
      onClick: () => router.push('/it?tab=tickets'),
    },
    {
      label: 'In Progress',
      value: d.inProgress ?? 0,
      icon: Wrench,
      iconColor: 'text-amber-500',
      bgColor: 'bg-amber-50',
      accent: false,
      onClick: () => router.push('/it?tab=board'),
    },
    {
      label: 'On Hold',
      value: d.onHold ?? 0,
      icon: PauseCircle,
      iconColor: 'text-orange-500',
      bgColor: 'bg-orange-50',
      accent: false,
      onClick: () => router.push('/it?tab=tickets'),
    },
    {
      label: 'Urgent',
      value: d.urgent ?? 0,
      icon: AlertTriangle,
      iconColor: 'text-red-500',
      bgColor: 'bg-red-50',
      accent: true,
      onClick: () => router.push('/it?tab=tickets'),
    },
    {
      label: 'Unassigned',
      value: d.unassignedCount ?? 0,
      icon: UserX,
      iconColor: 'text-violet-500',
      bgColor: 'bg-violet-50',
      accent: false,
      onClick: () => router.push('/it?tab=tickets'),
    },
    {
      label: 'Resolved (7d)',
      value: d.recentDone ?? 0,
      icon: CheckCircle2,
      iconColor: 'text-green-500',
      bgColor: 'bg-green-50',
      accent: false,
      onClick: () => router.push('/it?tab=tickets'),
    },
  ]

  // ─── Needs Attention aggregation ─────────────────────────────────────

  const urgentCount = d.urgent ?? 0
  const onHoldCount = d.onHold ?? 0
  const unassignedCount = d.unassignedCount ?? 0
  const onHoldByReason = d.onHoldByReason ?? {}
  const needsAttentionTotal = urgentCount + onHoldCount + unassignedCount

  const recentTickets = (d.recentTickets ?? []) as RecentTicket[]

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={staggerContainer(0.06, 0.04)}
    >
      {/* Stat Cards Row (6 cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon
          return (
            <motion.div
              key={card.label}
              variants={cardEntrance}
              custom={i}
              onClick={card.onClick}
              className={`cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.97] rounded-xl p-5 ${
                card.accent
                  ? 'bg-gradient-to-br from-red-50 to-red-100 border border-red-200'
                  : 'bg-white border border-gray-200'
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

      {/* Quick Action */}
      <motion.div variants={fadeInUp}>
        <button
          onClick={onCreateTicket}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all duration-200 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create Ticket
        </button>
      </motion.div>

      {/* E-Rate snapshot — only for users who can view E-Rate */}
      {itPerms.canViewERate && <ITERateWidget enabled />}

      {/* Two-column: Needs Attention + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Needs Attention */}
        <motion.div
          variants={fadeInUp}
          className={`rounded-xl p-5 border ${
            needsAttentionTotal > 0
              ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200'
              : 'bg-gradient-to-br from-green-50 to-green-100 border-green-200'
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
              <button
                onClick={() => router.push('/it?tab=tickets')}
                className="text-xs text-red-500 hover:text-red-700 transition-colors flex items-center gap-0.5 cursor-pointer"
              >
                View all
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {needsAttentionTotal > 0 ? (
            <div className="space-y-2">
              {urgentCount > 0 && (
                <div
                  className="flex items-center gap-2 p-3 bg-white/60 rounded-xl cursor-pointer hover:bg-white/80 transition-colors"
                  onClick={() => router.push('/it?tab=tickets')}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      {urgentCount} urgent ticket{urgentCount !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-slate-400">Marked as urgent priority</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                </div>
              )}
              {Object.entries(onHoldByReason).map(([reason, count]) => (
                <div
                  key={reason}
                  className="flex items-center gap-2 p-3 bg-white/60 rounded-xl cursor-pointer hover:bg-white/80 transition-colors"
                  onClick={() => router.push('/it?tab=tickets')}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      {count} on hold — {HOLD_REASON_LABELS[reason] ?? reason}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                </div>
              ))}
              {unassignedCount > 0 && (
                <div
                  className="flex items-center gap-2 p-3 bg-white/60 rounded-xl cursor-pointer hover:bg-white/80 transition-colors"
                  onClick={() => router.push('/it?tab=tickets')}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-violet-400 flex-shrink-0" />
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
                No urgent, on-hold, or unassigned tickets right now.
              </p>
            </div>
          )}
        </motion.div>

        {/* Recent Activity */}
        <motion.div variants={fadeInUp} className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800">Recent Activity</h3>
            <button
              onClick={() => router.push('/it?tab=tickets')}
              className="text-xs text-blue-500 hover:text-blue-700 transition-colors flex items-center gap-0.5 cursor-pointer"
            >
              View all
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {recentTickets.length > 0 ? (
            <div className="space-y-1">
              {recentTickets.map((ticket) => {
                const statusStyle = STATUS_COLORS[ticket.status] ?? STATUS_COLORS.BACKLOG
                return (
                  <div
                    key={ticket.id}
                    className="flex items-start gap-3 p-2.5 -mx-1 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => onViewTicket(ticket.id)}
                  >
                    <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${statusStyle.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        <span className="font-mono text-[10px] text-slate-400 mr-1.5">{ticket.ticketNumber}</span>
                        {ticket.title}
                      </p>
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
                <Monitor className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-500 mb-1">No active tickets</p>
              <p className="text-xs text-slate-400 max-w-[200px] leading-relaxed">
                Recent ticket activity will appear here.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}
