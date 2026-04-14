'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import {
  Plus,
  RefreshCw,
  Layers,
  AlertTriangle,
  Clock,
  Shield,
  AlertCircle,
  Calendar,
  CalendarDays,
  CheckSquare,
  Sparkles,
  Loader2,
  CheckCircle2,
  PartyPopper,
  CheckCircle,
  XCircle,
  Hourglass,
  ArrowRight,
  ChevronDown,
  Copy,
  LayoutGrid,
  List as ListIcon,
  Archive,
} from 'lucide-react'
import DashboardLayout from '@/components/DashboardLayout'
import { staggerContainer, cardEntrance, fadeInUp, listItem } from '@/lib/animations'
import { useEventProjects, type EventProject } from '@/lib/hooks/useEventProject'
import { useEventDashboard, useResolveAction } from '@/lib/hooks/useEventDashboard'
import type { ScoredActionItem, ActionItemType, ResolveAction } from '@/lib/services/eventDashboardService'
import { useAuth } from '@/lib/hooks/useAuth'
import { useIsDesktop } from '@/lib/hooks/useIsDesktop'
import AnimatedCounter from '@/components/motion/AnimatedCounter'
import { useToast } from '@/components/Toast'
import { CreateEventProjectModal } from '@/components/events/CreateEventProjectModal'
import { EventSeriesDrawer } from '@/components/events/EventSeriesDrawer'
import { TemplateListDrawer } from '@/components/events/templates/TemplateListDrawer'
import { CreateFromTemplateWizard } from '@/components/events/templates/CreateFromTemplateWizard'
import { EventBoard } from '@/components/events/board/EventBoard'
import { ArchiveDrawer } from '@/components/events/board/ArchiveDrawer'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useTrackModuleVisit } from '@/components/onboarding/ChecklistWidget'
import {
  SURFACE,
  BORDER,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  WARM_CHIP,
  WARM_CHIP_HOVER,
  CARD_SHADOW,
  STATUS_ACCENT,
} from '@/lib/design/warm-tokens'

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; icon: React.ElementType }> = {
  DRAFT: { label: 'Draft', bg: 'bg-slate-100', text: 'text-slate-600', icon: Clock },
  PENDING_APPROVAL: { label: 'Pending Approval', bg: 'bg-amber-50', text: 'text-amber-700', icon: Hourglass },
  CONFIRMED: { label: 'Confirmed', bg: 'bg-blue-50', text: 'text-blue-700', icon: CheckCircle },
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-green-50', text: 'text-green-700', icon: ArrowRight },
  COMPLETED: { label: 'Completed', bg: 'bg-purple-50', text: 'text-purple-700', icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelled', bg: 'bg-red-50', text: 'text-red-600', icon: XCircle },
}

const SOURCE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  DIRECT_REQUEST: { label: 'Direct Request', bg: 'bg-slate-100', text: 'text-slate-600' },
  SERIES: { label: 'Series', bg: 'bg-indigo-50', text: 'text-indigo-700' },
  PLANNING_SUBMISSION: { label: 'Planning', bg: 'bg-blue-50', text: 'text-blue-700' },
}

const FILTER_TABS = [
  { value: '', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
]

// ─── Dashboard constants ─────────────────────────────────────────────────────

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
  no_tasks: 'text-slate-400',
}

function urgencyBarColor(score: number): string {
  if (score >= 8) return 'bg-red-500'
  if (score >= 5) return 'bg-orange-500'
  return 'bg-blue-500'
}

const itemExit = {
  opacity: 0,
  x: 60,
  height: 0,
  marginBottom: 0,
  transition: { duration: 0.25 },
}

// ─── Stat Card (Cal.com editorial: large number + small uppercase label) ────

interface StatCardProps {
  label: string
  value: number
  icon: React.ElementType
}

function StatCard({ label, value, icon: Icon }: StatCardProps) {
  return (
    <div
      className="flex-1 min-w-0 px-4 sm:px-6 py-5 rounded-2xl flex items-center justify-between gap-3 sm:gap-4 h-full"
      style={{
        backgroundColor: SURFACE,
        border: `1px solid ${BORDER}`,
        boxShadow: CARD_SHADOW,
      }}
    >
      <div className="min-w-0">
        <div
          className="text-4xl font-semibold leading-none"
          style={{ color: TEXT_PRIMARY, letterSpacing: '-0.03em' }}
        >
          <AnimatedCounter value={value} />
        </div>
        <p
          className="mt-2 text-[11px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: TEXT_MUTED }}
        >
          {label}
        </p>
      </div>
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: WARM_CHIP }}
      >
        <Icon
          className="w-[18px] h-[18px]"
          strokeWidth={1.75}
          style={{ color: TEXT_PRIMARY }}
        />
      </div>
    </div>
  )
}

// ─── Gate Status Helpers ─────────────────────────────────────────────────────

const GATE_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  PENDING: { label: 'Pending', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  APPROVED: { label: 'Approved', bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-400' },
  REJECTED: { label: 'Rejected', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' },
  SKIPPED: { label: 'Skipped', bg: 'bg-slate-50', text: 'text-slate-500', dot: 'bg-slate-300' },
}

const GATE_LABELS: Record<string, string> = {
  av: 'AV',
  facilities: 'Facilities',
  admin: 'Admin',
}

function GateIndicators({ gates }: { gates: EventProject['approvalGates'] }) {
  if (!gates) return null

  const entries = Object.entries(gates).filter(([, v]) => v != null) as [string, { status: string }][]
  if (entries.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 mt-2.5">
      {entries.map(([key, gate]) => {
        const config = GATE_STATUS_CONFIG[gate.status] ?? GATE_STATUS_CONFIG.PENDING
        return (
          <span
            key={key}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${config.bg} ${config.text}`}
            title={`${GATE_LABELS[key] ?? key}: ${config.label}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
            {GATE_LABELS[key] ?? key}
          </span>
        )
      })}
    </div>
  )
}

// ─── Event Card ──────────────────────────────────────────────────────────────

function EventCard({ project, onClick }: { project: EventProject; onClick: () => void }) {
  const statusConfig = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.DRAFT
  const sourceConfig = SOURCE_CONFIG[project.source] ?? SOURCE_CONFIG.DIRECT_REQUEST
  const startsAt = new Date(project.startsAt)
  const endsAt = new Date(project.endsAt)
  const isToday = startsAt.toDateString() === new Date().toDateString()
  const weekday = startsAt.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  const dayNum = startsAt.getDate()
  const accentColor = STATUS_ACCENT[project.status] ?? STATUS_ACCENT.DRAFT

  const dateDisplay = project.isMultiDay
    ? `${format(startsAt, 'MMM d')} – ${format(endsAt, 'MMM d, yyyy')}`
    : format(startsAt, 'MMM d, yyyy')

  const creatorName = project.createdBy?.firstName
    ? `${project.createdBy.firstName} ${project.createdBy.lastName || ''}`.trim()
    : project.createdBy?.email

  return (
    <motion.div
      variants={cardEntrance}
      onClick={onClick}
      className="group flex items-start gap-4 px-5 py-4 rounded-2xl cursor-pointer transition-colors duration-200"
      style={{
        backgroundColor: SURFACE,
        border: `1px solid ${BORDER}`,
        boxShadow: CARD_SHADOW,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8f6f2')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = SURFACE)}
    >
      {/* Date chip */}
      <div className="flex-shrink-0 w-11 text-center pt-0.5">
        <div
          className="text-[9px] font-bold uppercase tracking-[0.1em]"
          style={{ color: isToday ? accentColor : TEXT_MUTED }}
        >
          {isToday ? 'TODAY' : weekday}
        </div>
        <div
          className="text-xl font-semibold leading-[1.1] mt-0.5"
          style={{ color: TEXT_PRIMARY }}
        >
          {dayNum}
        </div>
      </div>

      {/* Vertical accent bar */}
      <div
        className="flex-shrink-0 w-[3px] rounded-full self-stretch my-0.5"
        style={{ backgroundColor: accentColor }}
      />

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <h3
          className="text-[15px] font-semibold truncate"
          style={{ color: TEXT_PRIMARY, letterSpacing: '-0.005em' }}
        >
          {project.title}
        </h3>

        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <span
            className="text-[11px] font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: WARM_CHIP, color: TEXT_SECONDARY }}
          >
            {sourceConfig.label}
          </span>
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: `${accentColor}1a`,
              color: accentColor,
            }}
          >
            {statusConfig.label}
          </span>
        </div>

        {project.description && (
          <p
            className="mt-2 text-[12.5px] line-clamp-2"
            style={{ color: TEXT_SECONDARY }}
          >
            {project.description}
          </p>
        )}

        <div className="flex items-center gap-2 mt-1.5">
          <span
            className="text-[12.5px] font-medium"
            style={{ color: TEXT_SECONDARY }}
          >
            {dateDisplay}
          </span>
          {project.locationText && (
            <>
              <span style={{ color: TEXT_MUTED }}>·</span>
              <span
                className="text-[12.5px] truncate max-w-[160px]"
                style={{ color: TEXT_SECONDARY }}
              >
                {project.locationText}
              </span>
            </>
          )}
        </div>

        {creatorName && (
          <p className="text-[11.5px] mt-0.5" style={{ color: TEXT_MUTED }}>
            By {creatorName}
          </p>
        )}

        {/* Approval gate indicators */}
        {project.approvalGates && project.status === 'PENDING_APPROVAL' && (
          <GateIndicators gates={project.approvalGates} />
        )}

        {/* Rejection reason banner */}
        {project.rejectionReason && project.status === 'DRAFT' && (
          <div
            className="mt-2.5 px-3 py-2 rounded-lg"
            style={{
              backgroundColor: 'rgba(184, 74, 74, 0.08)',
              border: '1px solid rgba(184, 74, 74, 0.18)',
            }}
          >
            <p className="text-[11.5px] font-semibold" style={{ color: '#b84a4a' }}>
              Revision needed
            </p>
            <p className="text-[11.5px] mt-0.5" style={{ color: '#b84a4a' }}>
              {project.rejectionReason}
            </p>
          </div>
        )}
      </div>

      {/* Chevron on hover */}
      <ArrowRight
        className="flex-shrink-0 w-4 h-4 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ color: TEXT_MUTED }}
      />
    </motion.div>
  )
}

// ─── Action Item Card ────────────────────────────────────────────────────────

function ActionItemCard({ item, onResolve, isResolving }: {
  item: ScoredActionItem
  onResolve: (action: ResolveAction, item: ScoredActionItem) => void
  isResolving: boolean
}) {
  const router = useRouter()
  const Icon = ACTION_ICONS[item.type] ?? AlertCircle
  const iconColor = ACTION_COLORS[item.type] ?? 'text-slate-400'
  const barColor = urgencyBarColor(item.urgencyScore)

  // Pending approvals are NEVER actioned directly from the queue — the user
  // must open the event detail page and review context before approving via
  // the ApprovalReviewDrawer. For everything else (complete_task, navigate),
  // keep the inline button since those are safe low-stakes actions.
  const isPendingApproval = item.resolveAction.type === 'approve_event'
  const hasInlineAction = !isPendingApproval

  const resolveLabel = (() => {
    if (item.resolveAction.type === 'complete_task') return 'Mark Done'
    return 'Go to Event'
  })()

  const handleResolve = () => {
    if (item.resolveAction.type === 'navigate') {
      window.location.href = (item.resolveAction as { type: 'navigate'; url: string }).url
      return
    }
    onResolve(item.resolveAction, item)
  }

  const handleCardClick = () => {
    if (isPendingApproval) {
      router.push(`/events/${item.eventProjectId}`)
    }
  }

  return (
    <motion.div
      layout
      variants={listItem}
      exit={itemExit}
      onClick={isPendingApproval ? handleCardClick : undefined}
      className="group p-4 flex gap-3 rounded-2xl transition-colors duration-200"
      style={{
        backgroundColor: SURFACE,
        border: `1px solid ${BORDER}`,
        boxShadow: CARD_SHADOW,
        cursor: isPendingApproval ? 'pointer' : 'default',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8f6f2')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = SURFACE)}
    >
      <div className={`w-1 rounded-full flex-shrink-0 self-stretch ${barColor}`} />
      <div className="flex-shrink-0 mt-0.5">
        <Icon className={`w-5 h-5 ${iconColor}`} strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p
              className="text-[13.5px] font-semibold leading-snug"
              style={{ color: TEXT_PRIMARY, letterSpacing: '-0.005em' }}
            >
              {item.title}
            </p>
            <p
              className="text-[12px] mt-0.5 leading-relaxed"
              style={{ color: TEXT_SECONDARY }}
            >
              {item.description}
            </p>
            {item.aiReason && item.aiReason !== '' && !item.aiReason.includes('unavailable') && (
              <p
                className="text-[11.5px] mt-1 italic flex items-center gap-1"
                style={{ color: TEXT_MUTED }}
              >
                <Sparkles className="w-3 h-3 flex-shrink-0" />
                {item.aiReason}
              </p>
            )}
          </div>
          {hasInlineAction && (
            <div className="flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleResolve()
                }}
                disabled={isResolving}
                className="px-3 py-1.5 rounded-full text-[11.5px] font-semibold transition-all duration-200 cursor-pointer hover:-translate-y-px active:scale-[0.97] disabled:opacity-60"
                style={{
                  backgroundColor: TEXT_PRIMARY,
                  color: '#ffffff',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.04)',
                }}
              >
                {isResolving ? <Loader2 className="w-3 h-3 animate-spin" /> : resolveLabel}
              </button>
            </div>
          )}
          {isPendingApproval && (
            <ArrowRight
              className="flex-shrink-0 w-4 h-4 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              style={{ color: TEXT_MUTED }}
            />
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── AI Status Badge ─────────────────────────────────────────────────────────

function AiStatusBadge({ isLoadingScored, aiScored, hasItems }: {
  isLoadingScored: boolean
  aiScored: boolean
  hasItems: boolean
}) {
  if (!hasItems) return null

  if (isLoadingScored) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-stone-100 text-stone-500 text-xs rounded-full">
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
      className="inline-flex items-center gap-1 px-2.5 py-1 bg-stone-100 text-stone-500 text-xs rounded-full"
      title="Actions sorted by priority type (AI ranking unavailable)"
    >
      Manual Sort
    </span>
  )
}

// ─── Skeletons ───────────────────────────────────────────────────────────────

function StatsSkeleton() {
  return (
    <div className="flex gap-4 animate-pulse">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="flex-1 min-w-0 px-4 sm:px-6 py-5 rounded-2xl flex items-center justify-between gap-3 sm:gap-4 h-full"
          style={{
            backgroundColor: SURFACE,
            border: `1px solid ${BORDER}`,
            boxShadow: CARD_SHADOW,
          }}
        >
          <div className="space-y-3">
            <div className="w-16 h-9 rounded" style={{ backgroundColor: WARM_CHIP_HOVER }} />
            <div className="w-24 h-2.5 rounded" style={{ backgroundColor: WARM_CHIP }} />
          </div>
          <div className="w-10 h-10 rounded-xl" style={{ backgroundColor: WARM_CHIP }} />
        </div>
      ))}
    </div>
  )
}

function EventsListSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-2xl bg-stone-100 h-28" />
      ))}
    </div>
  )
}

function ApprovalsSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="ui-glass p-4 flex gap-3">
          <div className="w-1 bg-stone-200 rounded-full self-stretch" />
          <div className="w-5 h-5 bg-stone-200 rounded-full flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <div className="w-3/4 h-4 bg-slate-200 rounded" />
            <div className="w-full h-3 bg-stone-100 rounded" />
            <div className="w-20 h-5 bg-stone-100 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────────────

interface EventsEmptyStateProps {
  onCreateEvent: () => void
  onClearFilter?: () => void
  /** The currently-selected status filter label, or undefined when unfiltered. */
  filterLabel?: string
}

function EventsEmptyState({ onCreateEvent, onClearFilter, filterLabel }: EventsEmptyStateProps) {
  // Filter-aware copy: if the user has filtered to a status with no matches,
  // don't lie about having "no events" — show a filter-specific state instead.
  const isFiltered = !!filterLabel

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="text-center py-16"
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
        style={{ backgroundColor: WARM_CHIP }}
      >
        <Layers className="w-7 h-7" strokeWidth={1.75} style={{ color: TEXT_PRIMARY }} />
      </div>
      <h3
        className="text-[17px] font-semibold mb-2"
        style={{ color: TEXT_PRIMARY, letterSpacing: '-0.015em' }}
      >
        {isFiltered ? `No ${filterLabel.toLowerCase()} events` : 'No events yet'}
      </h3>
      <p
        className="text-[13.5px] max-w-sm mx-auto mb-6 leading-[1.55]"
        style={{ color: TEXT_SECONDARY }}
      >
        {isFiltered
          ? `You have events, but none match the "${filterLabel}" filter. Try a different filter or clear it to see everything.`
          : 'Create your first event to start planning, scheduling, and coordinating everything in one place.'}
      </p>
      {isFiltered ? (
        <button
          onClick={onClearFilter}
          className="px-5 py-2.5 rounded-full text-[13px] font-semibold transition-all duration-200 cursor-pointer hover:-translate-y-px"
          style={{
            backgroundColor: TEXT_PRIMARY,
            color: '#ffffff',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.04)',
          }}
        >
          Show All Events
        </button>
      ) : (
        <button
          onClick={onCreateEvent}
          className="px-5 py-2.5 rounded-full text-[13px] font-semibold transition-all duration-200 cursor-pointer hover:-translate-y-px"
          style={{
            backgroundColor: TEXT_PRIMARY,
            color: '#ffffff',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.04)',
          }}
        >
          Create First Event
        </button>
      )}
    </motion.div>
  )
}

// ─── Stats Row (2 cards, role-aware) ─────────────────────────────────────────

function StatsRow({ isAdmin }: { isAdmin: boolean }) {
  const { stats, isLoadingRaw } = useEventDashboard()

  if (isLoadingRaw) return <StatsSkeleton />

  return (
    <motion.div
      variants={staggerContainer(0.08, 0.1)}
      initial="hidden"
      animate="visible"
      className="flex gap-4"
    >
      {isAdmin ? (
        <>
          <motion.div variants={cardEntrance} className="flex-1">
            <StatCard
              label="Active Events"
              value={stats.totalActiveEvents}
              icon={Calendar}
            />
          </motion.div>
          <motion.div variants={cardEntrance} className="flex-1">
            <StatCard
              label="Needs Approval"
              value={stats.pendingApprovals}
              icon={Shield}
            />
          </motion.div>
        </>
      ) : (
        <>
          <motion.div variants={cardEntrance} className="flex-1">
            <StatCard
              label="My Events"
              value={stats.totalActiveEvents}
              icon={Calendar}
            />
          </motion.div>
          <motion.div variants={cardEntrance} className="flex-1">
            <StatCard
              label="Pending Review"
              value={stats.pendingApprovals}
              icon={Hourglass}
            />
          </motion.div>
        </>
      )}
    </motion.div>
  )
}

// ─── Approval Queue (admin right column) ─────────────────────────────────────

function ApprovalQueue() {
  const { items: allItems, aiScored, isLoadingRaw, isLoadingScored, isError } = useEventDashboard()
  const items = allItems.filter((item) => item.type === 'pending_approval')
  const resolveMutation = useResolveAction()
  const { toast } = useToast()
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set())

  const handleResolve = async (action: ResolveAction, item: ScoredActionItem) => {
    setResolvingIds((prev) => new Set(prev).add(item.id))
    try {
      await resolveMutation.mutateAsync(action)
      const successMsg =
        action.type === 'complete_task'
          ? 'Task marked as done'
          : action.type === 'approve_event'
            ? 'Event approved successfully'
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

  if (isLoadingRaw) return <ApprovalsSkeleton />

  if (isError) {
    return (
      <div className="ui-glass p-6 text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-stone-600">Failed to load approvals. Please refresh.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Event Approvals</h2>
        <AiStatusBadge
          isLoadingScored={isLoadingScored}
          aiScored={aiScored}
          hasItems={items.length > 0}
        />
      </div>

      {items.length === 0 ? (
        <motion.div
          variants={cardEntrance}
          initial="hidden"
          animate="visible"
          className="p-8 text-center rounded-2xl"
          style={{
            backgroundColor: SURFACE,
            border: `1px solid ${BORDER}`,
            boxShadow: CARD_SHADOW,
          }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ backgroundColor: WARM_CHIP }}
          >
            <PartyPopper
              className="w-6 h-6"
              strokeWidth={1.75}
              style={{ color: TEXT_PRIMARY }}
            />
          </div>
          <h3
            className="text-[14px] font-semibold"
            style={{ color: TEXT_PRIMARY, letterSpacing: '-0.01em' }}
          >
            All caught up!
          </h3>
          <p className="text-[12px] mt-1" style={{ color: TEXT_SECONDARY }}>
            No events waiting for approval.
          </p>
        </motion.div>
      ) : (
        <motion.div
          variants={staggerContainer(0.04, 0.1)}
          initial="hidden"
          animate="visible"
          className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto"
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
    </div>
  )
}

// ─── Event Create Menu (page header CTA — dropdown with create modes) ───────

type EventCreateMode = 'single' | 'multiday' | 'recurring' | 'template' | 'ai'

interface EventCreateMenuProps {
  isAdmin: boolean
  onSelect: (mode: EventCreateMode) => void
}

function EventCreateMenu({ isAdmin, onSelect }: EventCreateMenuProps) {
  const [open, setOpen] = useState(false)

  // "With AI" sits at the top as the recommended path for non-technical users,
  // visible to everyone. Admin-only options (recurring + template) stay hidden
  // from non-admins.
  const EVENT_OPTIONS: {
    mode: EventCreateMode
    label: string
    description: string
    icon: React.ElementType
    adminOnly?: boolean
    highlight?: boolean
  }[] = [
    { mode: 'ai', label: 'With AI (Leo)', description: 'Describe your event in plain English and let Leo draft it', icon: Sparkles, highlight: true },
    { mode: 'single', label: 'Single Event', description: 'A one-time event on a specific date', icon: Calendar },
    { mode: 'recurring', label: 'Recurring Event', description: 'Repeats on a schedule (weekly, monthly, etc.)', icon: RefreshCw, adminOnly: true },
    { mode: 'multiday', label: 'Multi-day Event', description: 'Spans across multiple days', icon: CalendarDays },
    { mode: 'template', label: 'From Template', description: 'Start from a saved event template', icon: Copy, adminOnly: true },
  ]

  const visibleOptions = isAdmin
    ? EVENT_OPTIONS
    : EVENT_OPTIONS.filter((o) => !o.adminOnly)

  const handleSelect = (mode: EventCreateMode) => {
    setOpen(false)
    onSelect(mode)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[13px] font-semibold transition-all duration-200 cursor-pointer hover:-translate-y-px"
        style={{
          backgroundColor: TEXT_PRIMARY,
          color: '#ffffff',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.04)',
        }}
      >
        <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
        Event
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Invisible backdrop to close dropdown */}
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />

            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-72 rounded-xl z-20 overflow-hidden"
              style={{
                backgroundColor: SURFACE,
                border: `1px solid ${BORDER}`,
                boxShadow: CARD_SHADOW,
              }}
            >
              <div className="p-1.5">
                {visibleOptions.map((opt) => {
                  const Icon = opt.icon
                  return (
                    <button
                      key={opt.mode}
                      onClick={() => handleSelect(opt.mode)}
                      className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer group"
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = WARM_CHIP)
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = 'transparent')
                      }
                    >
                      <div
                        className="mt-0.5 p-1.5 rounded-lg transition-colors"
                        style={{ backgroundColor: WARM_CHIP }}
                      >
                        <Icon
                          className="w-4 h-4"
                          strokeWidth={1.75}
                          style={{ color: TEXT_PRIMARY }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-[13.5px] font-semibold"
                          style={{ color: TEXT_PRIMARY, letterSpacing: '-0.005em' }}
                        >
                          {opt.label}
                        </p>
                        <p
                          className="text-[12px] mt-0.5"
                          style={{ color: TEXT_SECONDARY }}
                        >
                          {opt.description}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── My Events Panel ─────────────────────────────────────────────────────────

interface MyEventsPanelProps {
  isAdmin: boolean
  onOpenCreate: (mode: EventCreateMode) => void
}

function MyEventsPanel({ isAdmin, onOpenCreate }: MyEventsPanelProps) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState('')

  const filters = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(!isAdmin ? { createdBy: 'me' } : {}),
  }

  const { data: projects, isLoading } = useEventProjects(
    Object.keys(filters).length > 0 ? filters : undefined
  )

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-base font-semibold"
          style={{ color: TEXT_PRIMARY, letterSpacing: '-0.01em' }}
        >
          {isAdmin ? 'All Events' : 'My Events'}
        </h2>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        {FILTER_TABS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              statusFilter === f.value
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Event list */}
      {isLoading ? (
        <EventsListSkeleton />
      ) : !projects || projects.length === 0 ? (
        <EventsEmptyState
          onCreateEvent={() => onOpenCreate('single')}
          onClearFilter={() => setStatusFilter('')}
          filterLabel={
            statusFilter
              ? FILTER_TABS.find((f) => f.value === statusFilter)?.label
              : undefined
          }
        />
      ) : (
        <motion.div
          variants={staggerContainer(0.05)}
          initial="hidden"
          animate="visible"
          className="space-y-3"
        >
          {projects.map((project) => (
            <EventCard
              key={project.id}
              project={project}
              onClick={() => router.push(`/events/${project.id}`)}
            />
          ))}
        </motion.div>
      )}
    </div>
  )
}

// ─── View toggle ─────────────────────────────────────────────────────────────

type EventsView = 'board' | 'list'

interface ViewToggleProps {
  view: EventsView
  onChange: (v: EventsView) => void
}

function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div
      className="inline-flex items-center gap-0.5 p-0.5 rounded-full"
      style={{ backgroundColor: WARM_CHIP }}
    >
      <button
        onClick={() => onChange('board')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all cursor-pointer"
        style={{
          backgroundColor: view === 'board' ? '#ffffff' : 'transparent',
          color: view === 'board' ? TEXT_PRIMARY : TEXT_SECONDARY,
          boxShadow:
            view === 'board'
              ? '0 1px 2px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.04)'
              : 'none',
        }}
        aria-pressed={view === 'board'}
      >
        <LayoutGrid className="w-3.5 h-3.5" strokeWidth={2} />
        Board
      </button>
      <button
        onClick={() => onChange('list')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all cursor-pointer"
        style={{
          backgroundColor: view === 'list' ? '#ffffff' : 'transparent',
          color: view === 'list' ? TEXT_PRIMARY : TEXT_SECONDARY,
          boxShadow:
            view === 'list'
              ? '0 1px 2px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.04)'
              : 'none',
        }}
        aria-pressed={view === 'list'}
      >
        <ListIcon className="w-3.5 h-3.5" strokeWidth={2} />
        List
      </button>
    </div>
  )
}

// ─── Page Header ─────────────────────────────────────────────────────────────

interface EventsPageHeaderProps {
  isAdmin: boolean
  onOpenCreate: (mode: EventCreateMode) => void
  /** Board / list toggle — only rendered for admins on desktop */
  showViewToggle?: boolean
  view?: EventsView
  onViewChange?: (v: EventsView) => void
  /** Archive button — only rendered in board view */
  onOpenArchive?: () => void
  archiveCount?: number
}

function EventsPageHeader({
  isAdmin,
  onOpenCreate,
  showViewToggle = false,
  view = 'board',
  onViewChange,
  onOpenArchive,
  archiveCount,
}: EventsPageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1
          className="text-3xl font-semibold leading-[1.05]"
          style={{ color: TEXT_PRIMARY, letterSpacing: '-0.025em' }}
        >
          Events Hub
        </h1>
        <p
          className="mt-2 text-[13.5px] font-medium"
          style={{ color: TEXT_SECONDARY }}
        >
          {isAdmin
            ? 'Manage all your school events from planning to completion'
            : 'Your events and submissions'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {showViewToggle && view && onViewChange && (
          <ViewToggle view={view} onChange={onViewChange} />
        )}
        {onOpenArchive && (
          <button
            onClick={onOpenArchive}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-semibold transition-colors cursor-pointer"
            style={{ backgroundColor: WARM_CHIP, color: TEXT_PRIMARY }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = WARM_CHIP_HOVER)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = WARM_CHIP)}
            aria-label="Open archive"
          >
            <Archive className="w-3.5 h-3.5" strokeWidth={2} />
            Archive
            {typeof archiveCount === 'number' && archiveCount > 0 && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: '#ffffff', color: TEXT_SECONDARY }}
              >
                {archiveCount}
              </span>
            )}
          </button>
        )}
        <EventCreateMenu isAdmin={isAdmin} onSelect={onOpenCreate} />
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

const VIEW_STORAGE_KEY = 'events-hub-view'

export default function EventsPage() {
  usePageTitle('Events')
  useTrackModuleVisit('events')
  const router = useRouter()
  const { isAdmin, isReady, user } = useAuth()
  const isDesktop = useIsDesktop()

  // Lifted create-flow state so the CTA can live in the page header
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createMode, setCreateMode] = useState<EventCreateMode>('single')
  const [seriesDrawerOpen, setSeriesDrawerOpen] = useState(false)
  const [templateDrawerOpen, setTemplateDrawerOpen] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [archiveDrawerOpen, setArchiveDrawerOpen] = useState(false)

  // View toggle — board is default for admins on desktop. Persisted per-user
  // in localStorage so repeat visitors stay on their preferred view.
  const [view, setView] = useState<EventsView>('board')
  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY)
    if (stored === 'board' || stored === 'list') setView(stored)
  }, [])
  const handleViewChange = (v: EventsView) => {
    setView(v)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(VIEW_STORAGE_KEY, v)
    }
  }

  // Mobile (< 768px) always uses the list view — board is desktop-only.
  const effectiveView: EventsView = !isDesktop ? 'list' : view
  // Only admins see the board at all.
  const useBoard = isAdmin && effectiveView === 'board'

  // For the board, fetch ALL admin-visible events in one query (no status
  // filter, no createdBy filter). The board groups them into columns itself.
  const { data: allProjects = [] } = useEventProjects(
    useBoard ? undefined : undefined,
  )
  const archiveCount = allProjects.filter(
    (p) => p.status === 'COMPLETED' || p.status === 'CANCELLED',
  ).length

  const handleOpenCreate = (mode: EventCreateMode) => {
    if (mode === 'ai') {
      router.push('/events/new/ai')
    } else if (mode === 'recurring') {
      setSeriesDrawerOpen(true)
    } else if (mode === 'template') {
      setTemplateDrawerOpen(true)
    } else {
      setCreateMode(mode)
      setCreateModalOpen(true)
    }
  }

  if (!isReady) {
    return (
      <DashboardLayout>
        <div className="min-h-screen animate-pulse">
          <div className="h-8 w-48 bg-stone-200 rounded mb-4" />
          <div className="h-4 w-64 bg-stone-100 rounded" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen space-y-6">
        {/* Page header with + Event dropdown CTA, view toggle, archive */}
        <EventsPageHeader
          isAdmin={isAdmin}
          onOpenCreate={handleOpenCreate}
          showViewToggle={isAdmin && isDesktop}
          view={view}
          onViewChange={handleViewChange}
          onOpenArchive={useBoard ? () => setArchiveDrawerOpen(true) : undefined}
          archiveCount={useBoard ? archiveCount : undefined}
        />

        {useBoard ? (
          /* Board view — replaces the list + approval queue split entirely.
             Columns ARE the filters, column headers ARE the stats, the
             Pending Approval column IS the approval queue. */
          <EventBoard
            projects={allProjects}
            onCreateDraft={() => handleOpenCreate('single')}
            currentUserId={user.id}
          />
        ) : (
          <>
            {/* List view keeps the original stats row + panels */}
            <StatsRow isAdmin={isAdmin} />

            {isAdmin ? (
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-8">
                <div>
                  <MyEventsPanel isAdmin onOpenCreate={handleOpenCreate} />
                </div>
                <div>
                  <ApprovalQueue />
                </div>
              </div>
            ) : (
              <MyEventsPanel isAdmin={false} onOpenCreate={handleOpenCreate} />
            )}
          </>
        )}
      </div>

      {/* Create modals + drawers (lifted so CTA in header can trigger them) */}
      <CreateEventProjectModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        initialMode={createMode as 'single' | 'multiday'}
      />
      <EventSeriesDrawer
        isOpen={seriesDrawerOpen}
        onClose={() => setSeriesDrawerOpen(false)}
      />
      <TemplateListDrawer
        isOpen={templateDrawerOpen}
        onClose={() => setTemplateDrawerOpen(false)}
        onSelect={(templateId: string) => setSelectedTemplateId(templateId)}
      />
      {selectedTemplateId && (
        <CreateFromTemplateWizard
          templateId={selectedTemplateId}
          isOpen={!!selectedTemplateId}
          onClose={() => setSelectedTemplateId(null)}
        />
      )}
      <ArchiveDrawer
        isOpen={archiveDrawerOpen}
        onClose={() => setArchiveDrawerOpen(false)}
        projects={allProjects}
      />
    </DashboardLayout>
  )
}
