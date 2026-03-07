'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { queryOptions } from '@/lib/queries'
import { staggerContainer, fadeInUp, cardEntrance } from '@/lib/animations'
import AnimatedCounter from '@/components/motion/AnimatedCounter'
import { DashboardSkeleton } from './ITSkeleton'
import { IllustrationTickets } from '@/components/illustrations'
import {
  Monitor,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Wrench,
  PauseCircle,
  ShieldCheck,
  UserX,
  Activity,
  RefreshCw,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ITDashboardProps {
  onViewTicket: (ticketId: string) => void
  onCreateTicket: () => void
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
}

// ─── Config ──────────────────────────────────────────────────────────────────

const IT_STATUSES = [
  { label: 'Backlog', key: 'BACKLOG', color: '#64748b' },
  { label: 'To Do', key: 'TODO', color: '#3b82f6' },
  { label: 'In Progress', key: 'IN_PROGRESS', color: '#f59e0b' },
  { label: 'On Hold', key: 'ON_HOLD', color: '#ef4444' },
  { label: 'Done', key: 'DONE', color: '#22c55e' },
  { label: 'Cancelled', key: 'CANCELLED', color: '#94a3b8' },
]

const IT_ISSUE_TYPES = [
  { label: 'Hardware', key: 'HARDWARE', color: '#6366f1' },
  { label: 'Software', key: 'SOFTWARE', color: '#3b82f6' },
  { label: 'Account / Password', key: 'ACCOUNT_PASSWORD', color: '#f59e0b' },
  { label: 'Network', key: 'NETWORK', color: '#10b981' },
  { label: 'Display / A/V', key: 'DISPLAY_AV', color: '#8b5cf6' },
  { label: 'Other', key: 'OTHER', color: '#94a3b8' },
]

const HOLD_REASON_LABELS: Record<string, string> = {
  PARTS: 'Waiting on parts',
  VENDOR: 'Waiting on vendor',
  USER_AVAILABILITY: 'User availability',
  THIRD_PARTY: 'Third party',
  OTHER: 'Other',
}

const SOURCE_LABELS: Record<string, string> = {
  AUTHENTICATED: 'Staff portal',
  MAGIC_LINK: 'Magic link',
  SUB_SUBMITTED: 'Quick submit',
}

const SOURCE_COLORS: Record<string, string> = {
  AUTHENTICATED: '#3b82f6',
  MAGIC_LINK: '#8b5cf6',
  SUB_SUBMITTED: '#f59e0b',
}

// ─── Helper components ───────────────────────────────────────────────────────

function PanelHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
    </div>
  )
}

function EmptyState({ heading, description }: { heading: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <IllustrationTickets className="w-40 h-32 mb-2" />
      <p className="text-sm font-medium text-gray-500 mb-1">{heading}</p>
      <p className="text-xs text-gray-400 max-w-[200px] leading-relaxed">{description}</p>
    </div>
  )
}

function formatResolutionTime(hours: number | null): string {
  if (hours === null) return '—'
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 24) return `${Math.round(hours)}h`
  const days = Math.round(hours / 24)
  return `${days}d`
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function HorizontalBarChart({
  items,
  data,
}: {
  items: { label: string; key: string; color: string }[]
  data: Record<string, number>
}) {
  const maxCount = Math.max(1, ...Object.values(data))
  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const count = data[item.key] ?? 0
        const pct = Math.round((count / maxCount) * 100)
        return (
          <div key={item.key} className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-28 flex-shrink-0 truncate">{item.label}</span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, backgroundColor: item.color }}
              />
            </div>
            <span className="text-xs text-gray-400 w-5 text-right flex-shrink-0">
              {count}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function ITDashboard({ onViewTicket, onCreateTicket }: ITDashboardProps) {
  const { data: stats, isLoading, isError, refetch } = useQuery(queryOptions.itDashboard())

  if (isError) {
    return (
      <div className="ui-glass rounded-2xl p-10 flex flex-col items-center justify-center text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mb-3" />
        <p className="text-sm font-medium text-gray-600 mb-1">Unable to load dashboard data</p>
        <p className="text-xs text-gray-400 mb-4">Check your connection and try again.</p>
        <button
          onClick={() => refetch()}
          className="px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all inline-flex items-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    )
  }

  if (isLoading) return <DashboardSkeleton />

  const d = (stats ?? {}) as DashboardStats

  const statCards = [
    { label: 'Open', value: d.open ?? 0, icon: Monitor, iconColor: 'text-blue-500', bgColor: 'bg-blue-50', accent: false },
    { label: 'In Progress', value: d.inProgress ?? 0, icon: Wrench, iconColor: 'text-amber-500', bgColor: 'bg-amber-50', accent: false },
    { label: 'On Hold', value: d.onHold ?? 0, icon: PauseCircle, iconColor: 'text-orange-500', bgColor: 'bg-orange-50', accent: false },
    { label: 'Urgent', value: d.urgent ?? 0, icon: AlertTriangle, iconColor: 'text-red-500', bgColor: 'bg-red-50', accent: true },
    { label: 'Unassigned', value: d.unassignedCount ?? 0, icon: UserX, iconColor: 'text-violet-500', bgColor: 'bg-violet-50', accent: false },
    { label: 'Resolved (7d)', value: d.recentDone ?? 0, icon: CheckCircle2, iconColor: 'text-green-500', bgColor: 'bg-green-50', accent: false },
  ]

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={staggerContainer(0.06, 0.04)}
    >
      {/* ── Stat Cards Row (6 cards) ────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
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

      {/* ── Two-Column Panel Grid ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-4">
          {/* Tickets by Status */}
          <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl">
            <PanelHeader title="Tickets by Status" />
            <HorizontalBarChart items={IT_STATUSES} data={d.byStatus ?? {}} />
          </motion.div>

          {/* Tickets by Issue Type */}
          <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl">
            <PanelHeader title="Tickets by Issue Type" />
            {Object.keys(d.byIssueType ?? {}).length > 0 ? (
              <HorizontalBarChart items={IT_ISSUE_TYPES} data={d.byIssueType ?? {}} />
            ) : (
              <EmptyState
                heading="No active tickets"
                description="Issue type breakdown will appear when tickets are created."
              />
            )}
          </motion.div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Urgent / On Hold Alerts */}
          <motion.div
            variants={fadeInUp}
            className="bg-gradient-to-br from-red-50/80 to-red-100/80 backdrop-blur-sm border border-red-200/30 rounded-2xl p-5 shadow-sm"
          >
            <PanelHeader title="Urgent / On Hold Alerts" />
            {(d.urgent ?? 0) > 0 || (d.onHold ?? 0) > 0 ? (
              <div className="space-y-2">
                {(d.urgent ?? 0) > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-white/60 rounded-xl">
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-red-700">
                        {d.urgent} urgent ticket{d.urgent !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-red-400">Marked as urgent priority</p>
                    </div>
                  </div>
                )}
                {Object.entries(d.onHoldByReason ?? {}).map(([reason, count]) => (
                  <div key={reason} className="flex items-center gap-2 p-3 bg-white/60 rounded-xl">
                    <PauseCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-red-700">
                        {count} on hold — {HOLD_REASON_LABELS[reason] ?? reason}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-white/60 flex items-center justify-center mb-3">
                  <ShieldCheck className="w-6 h-6 text-red-300" />
                </div>
                <p className="text-sm font-medium text-red-700 mb-1">No urgent alerts</p>
                <p className="text-xs text-red-400 max-w-[180px] leading-relaxed">
                  Urgent and on-hold tickets will appear here.
                </p>
              </div>
            )}
          </motion.div>

          {/* Unassigned Tickets */}
          <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl">
            <PanelHeader title="Unassigned Tickets" />
            {(d.unassignedCount ?? 0) > 0 ? (
              <div className="flex items-center gap-3 py-2">
                <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center">
                  <UserX className="w-6 h-6 text-violet-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    <AnimatedCounter value={d.unassignedCount ?? 0} />
                  </p>
                  <p className="text-xs text-gray-400">tickets need assignment</p>
                </div>
              </div>
            ) : (
              <EmptyState
                heading="All assigned"
                description="No unassigned active tickets — great work!"
              />
            )}
          </motion.div>

          {/* Avg. Resolution Time */}
          <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl">
            <PanelHeader title="Avg. Resolution Time" />
            {d.avgResolutionHours !== null ? (
              <div className="flex items-center gap-3 py-2">
                <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-primary-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatResolutionTime(d.avgResolutionHours)}
                  </p>
                  <p className="text-xs text-gray-400">average across completed tickets</p>
                </div>
              </div>
            ) : (
              <EmptyState
                heading="No completed tickets yet"
                description="Resolution time will appear once tickets are marked done."
              />
            )}
          </motion.div>
        </div>
      </div>

      {/* ── Full-Width Bottom Row ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Recent Activity */}
        <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl">
          <PanelHeader title="Recent Activity" />
          {(d.recentActivity ?? []).length > 0 ? (
            <div className="space-y-2">
              {d.recentActivity.map((a) => (
                <button
                  key={a.id}
                  onClick={() => onViewTicket(a.ticketId)}
                  className="w-full text-left flex items-start gap-3 p-2.5 rounded-xl hover:bg-gray-50/70 transition-colors cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Activity className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">
                      <span className="font-mono text-xs text-gray-400 mr-1.5">{a.ticketNumber}</span>
                      {a.content || a.type.replace(/_/g, ' ').toLowerCase()}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {a.actorName ?? 'System'} · {relativeTime(a.createdAt)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              heading="No recent activity"
              description="Ticket updates, comments, and assignments will appear here."
            />
          )}
        </motion.div>

        {/* Submission Sources */}
        <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl">
          <PanelHeader title="Submission Sources" />
          {Object.keys(d.bySource ?? {}).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(d.bySource).map(([source, count]) => {
                const total = Object.values(d.bySource).reduce((s, v) => s + v, 0)
                const pct = total > 0 ? Math.round((count / total) * 100) : 0
                return (
                  <div key={source} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-24 flex-shrink-0 truncate">
                      {SOURCE_LABELS[source] ?? source}
                    </span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: SOURCE_COLORS[source] ?? '#94a3b8',
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-12 text-right flex-shrink-0">
                      {count} ({pct}%)
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState
              heading="No tickets yet"
              description="Source breakdown will appear once tickets are submitted."
            />
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}
