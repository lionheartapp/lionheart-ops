'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  AlertTriangle,
  Clock,
  Shield,
  AlertCircle,
  Calendar,
  CheckSquare,
  Sparkles,
  Loader2,
  CheckCircle2,
  ArrowRight,
  PartyPopper,
} from 'lucide-react'
import { useEventDashboard, useResolveAction } from '@/lib/hooks/useEventDashboard'
import type { ScoredActionItem, ActionItemType, ResolveAction } from '@/lib/services/eventDashboardService'
import AnimatedCounter from '@/components/motion/AnimatedCounter'
import { staggerContainer, listItem, cardEntrance } from '@/lib/animations'
import { useToast } from '@/components/Toast'

// ─── Icon map by action item type ─────────────────────────────────────────────

const ACTION_ICONS: Record<ActionItemType, React.ElementType> = {
  overdue_task: AlertTriangle,
  upcoming_deadline: Clock,
  pending_approval: Shield,
  missing_field: AlertCircle,
  no_schedule: Calendar,
  no_tasks: CheckSquare,
}

const ACTION_COLORS: Record<ActionItemType, string> = {
  overdue_task: 'text-red-500',
  upcoming_deadline: 'text-orange-500',
  pending_approval: 'text-blue-500',
  missing_field: 'text-yellow-600',
  no_schedule: 'text-purple-500',
  no_tasks: 'text-gray-400',
}

// ─── Urgency bar color based on score ─────────────────────────────────────────

function urgencyBarColor(score: number): string {
  if (score >= 8) return 'bg-red-500'
  if (score >= 5) return 'bg-orange-500'
  return 'bg-blue-500'
}

// ─── Exit animation for resolved items ────────────────────────────────────────

const itemExit = {
  opacity: 0,
  x: 60,
  height: 0,
  marginBottom: 0,
  transition: { duration: 0.25 },
}

// ─── Action Item Card ──────────────────────────────────────────────────────────

interface ActionItemCardProps {
  item: ScoredActionItem
  onResolve: (action: ResolveAction, item: ScoredActionItem) => void
  isResolving: boolean
}

function ActionItemCard({ item, onResolve, isResolving }: ActionItemCardProps) {
  const Icon = ACTION_ICONS[item.type] ?? AlertCircle
  const iconColor = ACTION_COLORS[item.type] ?? 'text-gray-400'
  const barColor = urgencyBarColor(item.urgencyScore)

  const resolveLabel = (() => {
    if (item.resolveAction.type === 'complete_task') return 'Mark Done'
    if (item.resolveAction.type === 'approve_event') return 'Approve'
    return 'Go to Event'
  })()

  const resolveButtonClass = (() => {
    if (item.resolveAction.type === 'complete_task')
      return 'px-3 py-1.5 rounded-full bg-green-600 text-white text-xs font-medium hover:bg-green-700 active:scale-[0.97] transition-all duration-200 cursor-pointer'
    if (item.resolveAction.type === 'approve_event')
      return 'px-3 py-1.5 rounded-full bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 active:scale-[0.97] transition-all duration-200 cursor-pointer'
    return 'px-3 py-1.5 rounded-full bg-gray-900 text-white text-xs font-medium hover:bg-gray-700 active:scale-[0.97] transition-all duration-200 cursor-pointer'
  })()

  const handleResolve = () => {
    if (item.resolveAction.type === 'navigate') {
      // Navigate doesn't need a server call
      window.location.href = (item.resolveAction as { type: 'navigate'; url: string }).url
      return
    }
    onResolve(item.resolveAction, item)
  }

  return (
    <motion.div
      layout
      variants={listItem}
      exit={itemExit}
      className="ui-glass-hover p-4 flex gap-3"
    >
      {/* Urgency bar */}
      <div className={`w-1 rounded-full flex-shrink-0 self-stretch ${barColor}`} />

      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 leading-snug">{item.title}</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.description}</p>

            {/* Event badge */}
            <span className="inline-block mt-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded-full font-medium">
              {item.eventProjectTitle}
            </span>

            {/* AI reason */}
            {item.aiReason && item.aiReason !== '' && !item.aiReason.includes('unavailable') && (
              <p className="text-xs text-gray-400 mt-1 italic flex items-center gap-1">
                <Sparkles className="w-3 h-3 flex-shrink-0" />
                {item.aiReason}
              </p>
            )}
          </div>

          {/* Resolve button */}
          <div className="flex-shrink-0">
            <button
              onClick={handleResolve}
              disabled={isResolving}
              className={resolveButtonClass}
            >
              {isResolving ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                resolveLabel
              )}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: number
  icon: React.ElementType
  accent?: boolean
}

function StatCard({ label, value, icon: Icon, accent }: StatCardProps) {
  return (
    <div
      className={
        accent
          ? 'bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-2xl p-4 text-center'
          : 'ui-glass p-4 text-center'
      }
    >
      <Icon className={`w-5 h-5 mx-auto mb-1.5 ${accent ? 'text-red-500' : 'text-gray-400'}`} />
      <div className={`text-2xl font-bold ${accent ? 'text-red-700' : 'text-gray-900'}`}>
        <AnimatedCounter value={value} />
      </div>
      <p className={`text-xs mt-0.5 ${accent ? 'text-red-600' : 'text-gray-500'}`}>{label}</p>
    </div>
  )
}

// ─── Skeleton Loading ─────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="ui-glass p-4 animate-pulse">
            <div className="w-5 h-5 bg-gray-200 rounded-full mx-auto mb-2" />
            <div className="w-8 h-6 bg-gray-200 rounded mx-auto mb-1" />
            <div className="w-16 h-3 bg-gray-100 rounded mx-auto" />
          </div>
        ))}
      </div>

      {/* Action items skeleton */}
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="ui-glass p-4 animate-pulse flex gap-3">
            <div className="w-1 bg-gray-200 rounded-full self-stretch" />
            <div className="w-5 h-5 bg-gray-200 rounded-full flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <div className="w-3/4 h-4 bg-gray-200 rounded" />
              <div className="w-full h-3 bg-gray-100 rounded" />
              <div className="w-20 h-5 bg-gray-100 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── AI Status Badge ──────────────────────────────────────────────────────────

interface AiStatusBadgeProps {
  isLoadingScored: boolean
  aiScored: boolean
  hasItems: boolean
}

function AiStatusBadge({ isLoadingScored, aiScored, hasItems }: AiStatusBadgeProps) {
  if (!hasItems) return null

  if (isLoadingScored) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-500 text-xs rounded-full">
        <Loader2 className="w-3 h-3 animate-spin" />
        AI ranking...
      </span>
    )
  }

  if (aiScored) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 text-xs rounded-full"
        title="Actions ranked by AI based on urgency, deadlines, and event proximity"
      >
        <Sparkles className="w-3 h-3" />
        AI Ranked
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-500 text-xs rounded-full"
      title="Actions sorted by priority type (AI ranking unavailable)"
    >
      Manual Sort
    </span>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <motion.div
      variants={cardEntrance}
      initial="hidden"
      animate="visible"
      className="ui-glass p-12 text-center"
    >
      <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <PartyPopper className="w-7 h-7 text-green-500" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900">All caught up!</h3>
      <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
        No urgent action items across your events. Great job!
      </p>
      <Link
        href="/events"
        className="inline-flex items-center gap-1.5 mt-4 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors duration-200"
      >
        View all events
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </motion.div>
  )
}

// ─── Main EventDashboard Component ────────────────────────────────────────────

export default function EventDashboard() {
  const { items, stats, aiScored, isLoadingRaw, isLoadingScored, isError } = useEventDashboard()
  const resolveMutation = useResolveAction()
  const { toast } = useToast()
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set())

  const handleResolve = async (action: ResolveAction, item: ScoredActionItem) => {
    setResolvingIds((prev) => new Set(prev).add(item.id))

    try {
      await resolveMutation.mutateAsync(action)

      const successMsg =
        action.type === 'complete_task'
          ? `Task marked as done`
          : action.type === 'approve_event'
            ? `Event approved successfully`
            : 'Navigating to event'

      toast(successMsg, 'success')
    } catch {
      toast('Failed to resolve action. Please try again.', 'error')
    } finally {
      setResolvingIds((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }

  if (isLoadingRaw) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Event Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Loading your action items...</p>
        </div>
        <DashboardSkeleton />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Event Dashboard</h1>
        <div className="ui-glass p-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Failed to load dashboard. Please refresh.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <motion.div
        variants={staggerContainer(0.05)}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={listItem} className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Event Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">
              Action items across all your active events, ranked by urgency.
            </p>
          </div>
          <Link
            href="/events"
            className="flex-shrink-0 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors duration-200 mt-1"
          >
            All events
          </Link>
        </motion.div>
      </motion.div>

      {/* Stats row */}
      <motion.div
        variants={staggerContainer(0.06, 0.1)}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        <motion.div variants={cardEntrance}>
          <StatCard
            label="Active Events"
            value={stats.totalActiveEvents}
            icon={Calendar}
          />
        </motion.div>
        <motion.div variants={cardEntrance}>
          <StatCard
            label="Overdue Items"
            value={stats.overdueItems}
            icon={AlertTriangle}
            accent={stats.overdueItems > 0}
          />
        </motion.div>
        <motion.div variants={cardEntrance}>
          <StatCard
            label="Due This Week"
            value={stats.upcomingDeadlines}
            icon={Clock}
          />
        </motion.div>
        <motion.div variants={cardEntrance}>
          <StatCard
            label="Need Approval"
            value={stats.pendingApprovals}
            icon={Shield}
          />
        </motion.div>
      </motion.div>

      {/* Action items section */}
      <div className="space-y-3">
        {/* Section header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            Priority Actions
          </h2>
          <AiStatusBadge
            isLoadingScored={isLoadingScored}
            aiScored={aiScored}
            hasItems={items.length > 0}
          />
        </div>

        {/* Items */}
        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <motion.div
            variants={staggerContainer(0.04, 0.1)}
            initial="hidden"
            animate="visible"
            className="space-y-2"
          >
            <AnimatePresence mode="popLayout">
              {items.map((item) => (
                <ActionItemCard
                  key={item.id}
                  item={item}
                  onResolve={handleResolve}
                  isResolving={resolvingIds.has(item.id)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* All caught up indicator when items were resolved */}
        {items.length === 0 && !isLoadingRaw && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center gap-2 text-sm text-green-600 py-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>All action items resolved</span>
          </motion.div>
        )}
      </div>
    </div>
  )
}
