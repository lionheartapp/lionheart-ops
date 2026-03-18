'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import {
  Plus,
  CalendarRange,
  RefreshCw,
  Layers,
  LayoutTemplate,
  AlertTriangle,
  Clock,
  Shield,
  AlertCircle,
  Calendar,
  CheckSquare,
  Sparkles,
  Loader2,
  CheckCircle2,
  PartyPopper,
  CheckCircle,
  XCircle,
  Hourglass,
  ArrowRight,
} from 'lucide-react'
import DashboardLayout from '@/components/DashboardLayout'
import { staggerContainer, cardEntrance, fadeInUp, listItem } from '@/lib/animations'
import { useEventProjects, type EventProject } from '@/lib/hooks/useEventProject'
import { useEventDashboard, useResolveAction } from '@/lib/hooks/useEventDashboard'
import type { ScoredActionItem, ActionItemType, ResolveAction } from '@/lib/services/eventDashboardService'
import { useAuth } from '@/lib/hooks/useAuth'
import AnimatedCounter from '@/components/motion/AnimatedCounter'
import { useToast } from '@/components/Toast'
import { CreateEventProjectModal } from '@/components/events/CreateEventProjectModal'
import { EventSeriesDrawer } from '@/components/events/EventSeriesDrawer'
import { TemplateListDrawer } from '@/components/events/templates/TemplateListDrawer'
import { CreateFromTemplateWizard } from '@/components/events/templates/CreateFromTemplateWizard'

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; icon: React.ElementType }> = {
  DRAFT: { label: 'Draft', bg: 'bg-gray-100', text: 'text-gray-600', icon: Clock },
  PENDING_APPROVAL: { label: 'Pending Approval', bg: 'bg-amber-50', text: 'text-amber-700', icon: Hourglass },
  CONFIRMED: { label: 'Confirmed', bg: 'bg-blue-50', text: 'text-blue-700', icon: CheckCircle },
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-green-50', text: 'text-green-700', icon: ArrowRight },
  COMPLETED: { label: 'Completed', bg: 'bg-purple-50', text: 'text-purple-700', icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelled', bg: 'bg-red-50', text: 'text-red-600', icon: XCircle },
}

const SOURCE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  DIRECT_REQUEST: { label: 'Direct Request', bg: 'bg-gray-100', text: 'text-gray-600' },
  SERIES: { label: 'Series', bg: 'bg-indigo-50', text: 'text-indigo-700' },
  PLANNING_SUBMISSION: { label: 'Planning', bg: 'bg-blue-50', text: 'text-blue-700' },
}

const FILTER_TABS = [
  { value: '', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_APPROVAL', label: 'Pending' },
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
  no_tasks: 'text-gray-400',
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

// ─── Stat Card (styled like reference image) ─────────────────────────────────

interface StatCardProps {
  label: string
  value: number
  icon: React.ElementType
  iconBg: string
  iconColor: string
}

function StatCard({ label, value, icon: Icon, iconBg, iconColor }: StatCardProps) {
  return (
    <div className="ui-glass flex-1 min-w-[200px] px-5 py-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-bold text-gray-900 leading-none">
            <AnimatedCounter value={value} />
          </span>
          <span className="text-xs text-gray-400 font-medium">{value === 1 ? 'event' : 'events'}</span>
        </div>
        <p className="text-sm font-semibold text-gray-700 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

// ─── Gate Status Helpers ─────────────────────────────────────────────────────

const GATE_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  PENDING: { label: 'Pending', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  APPROVED: { label: 'Approved', bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-400' },
  REJECTED: { label: 'Rejected', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' },
  SKIPPED: { label: 'Skipped', bg: 'bg-gray-50', text: 'text-gray-500', dot: 'bg-gray-300' },
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
      className="ui-glass-hover p-5 rounded-2xl cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-gray-900 flex-1 min-w-0 truncate">
          {project.title}
        </h3>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sourceConfig.bg} ${sourceConfig.text}`}>
            {sourceConfig.label}
          </span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusConfig.bg} ${statusConfig.text}`}>
            {statusConfig.label}
          </span>
        </div>
      </div>

      {project.description && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-2">{project.description}</p>
      )}

      <div className="flex items-center gap-3 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <CalendarRange className="w-3.5 h-3.5" />
          {dateDisplay}
        </div>
        {project.locationText && (
          <span className="truncate max-w-[120px]">{project.locationText}</span>
        )}
      </div>

      {creatorName && (
        <p className="text-xs text-gray-400 mt-2">By {creatorName}</p>
      )}

      {/* Approval gate indicators */}
      {project.approvalGates && project.status === 'PENDING_APPROVAL' && (
        <GateIndicators gates={project.approvalGates} />
      )}

      {/* Rejection reason banner */}
      {project.rejectionReason && project.status === 'DRAFT' && (
        <div className="mt-2.5 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
          <p className="text-xs text-red-700 font-medium">Revision needed</p>
          <p className="text-xs text-red-600 mt-0.5">{project.rejectionReason}</p>
        </div>
      )}
    </motion.div>
  )
}

// ─── Action Item Card ────────────────────────────────────────────────────────

function ActionItemCard({ item, onResolve, isResolving }: {
  item: ScoredActionItem
  onResolve: (action: ResolveAction, item: ScoredActionItem) => void
  isResolving: boolean
}) {
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
      <div className={`w-1 rounded-full flex-shrink-0 self-stretch ${barColor}`} />
      <div className="flex-shrink-0 mt-0.5">
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 leading-snug">{item.title}</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.description}</p>
            <span className="inline-block mt-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded-full font-medium">
              {item.eventProjectTitle}
            </span>
            {item.aiReason && item.aiReason !== '' && !item.aiReason.includes('unavailable') && (
              <p className="text-xs text-gray-400 mt-1 italic flex items-center gap-1">
                <Sparkles className="w-3 h-3 flex-shrink-0" />
                {item.aiReason}
              </p>
            )}
          </div>
          <div className="flex-shrink-0">
            <button
              onClick={handleResolve}
              disabled={isResolving}
              className={resolveButtonClass}
            >
              {isResolving ? <Loader2 className="w-3 h-3 animate-spin" /> : resolveLabel}
            </button>
          </div>
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

// ─── Skeletons ───────────────────────────────────────────────────────────────

function StatsSkeleton() {
  return (
    <div className="flex gap-4 animate-pulse">
      {[0, 1].map((i) => (
        <div key={i} className="ui-glass flex-1 min-w-[200px] px-5 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gray-200 flex-shrink-0" />
          <div className="space-y-2">
            <div className="w-12 h-5 bg-gray-200 rounded" />
            <div className="w-24 h-3 bg-gray-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EventsListSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-2xl bg-gray-100 h-28" />
      ))}
    </div>
  )
}

function ApprovalsSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="ui-glass p-4 flex gap-3">
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
  )
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EventsEmptyState({ onCreateEvent }: { onCreateEvent: () => void }) {
  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="text-center py-16">
      <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
        <Layers className="w-7 h-7 text-indigo-500" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-2">No events yet</h3>
      <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
        Create your first event to start planning, scheduling, and coordinating everything in one place.
      </p>
      <button
        onClick={onCreateEvent}
        className="px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all cursor-pointer"
      >
        Create First Event
      </button>
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
              iconBg="bg-blue-50"
              iconColor="text-blue-500"
            />
          </motion.div>
          <motion.div variants={cardEntrance} className="flex-1">
            <StatCard
              label="Needs Approval"
              value={stats.pendingApprovals}
              icon={Shield}
              iconBg={stats.pendingApprovals > 0 ? 'bg-amber-50' : 'bg-gray-50'}
              iconColor={stats.pendingApprovals > 0 ? 'text-amber-500' : 'text-gray-400'}
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
              iconBg="bg-blue-50"
              iconColor="text-blue-500"
            />
          </motion.div>
          <motion.div variants={cardEntrance} className="flex-1">
            <StatCard
              label="Pending Review"
              value={stats.pendingApprovals}
              icon={Hourglass}
              iconBg={stats.pendingApprovals > 0 ? 'bg-amber-50' : 'bg-gray-50'}
              iconColor={stats.pendingApprovals > 0 ? 'text-amber-500' : 'text-gray-400'}
            />
          </motion.div>
        </>
      )}
    </motion.div>
  )
}

// ─── Approval Queue (admin right column) ─────────────────────────────────────

function ApprovalQueue() {
  const { items, aiScored, isLoadingRaw, isLoadingScored, isError } = useEventDashboard()
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
        <p className="text-sm text-gray-600">Failed to load approvals. Please refresh.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Event Approvals</h2>
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
          className="ui-glass p-8 text-center"
        >
          <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <PartyPopper className="w-6 h-6 text-green-500" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">All caught up!</h3>
          <p className="text-xs text-gray-500 mt-1">No events waiting for approval.</p>
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

// ─── My Events Panel ─────────────────────────────────────────────────────────

function MyEventsPanel({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState('')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [seriesDrawerOpen, setSeriesDrawerOpen] = useState(false)
  const [templateDrawerOpen, setTemplateDrawerOpen] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)

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
      <h2 className="text-base font-semibold text-gray-900 mb-4">
        {isAdmin ? 'All Events' : 'My Events'}
      </h2>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {isAdmin && (
          <>
            <button
              onClick={() => setTemplateDrawerOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 active:scale-[0.97] transition-all cursor-pointer"
            >
              <LayoutTemplate className="w-4 h-4" />
              From Template
            </button>
            <button
              onClick={() => setSeriesDrawerOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 active:scale-[0.97] transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              New Series
            </button>
          </>
        )}
        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          New Event
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        {FILTER_TABS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              statusFilter === f.value
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
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
        <EventsEmptyState onCreateEvent={() => setCreateModalOpen(true)} />
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

      {/* Modals */}
      <CreateEventProjectModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
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
    </div>
  )
}

// ─── Page Header ─────────────────────────────────────────────────────────────

function EventsPageHeader({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-gray-900">Events Hub</h1>
        <p className="text-sm text-gray-500 mt-1">
          {isAdmin
            ? 'Manage all your school events from planning to completion'
            : 'Your events and submissions'}
        </p>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function EventsPage() {
  const { isAdmin, isReady } = useAuth()

  if (!isReady) {
    return (
      <DashboardLayout>
        <div className="min-h-screen animate-pulse">
          <div className="h-8 w-48 bg-gray-200 rounded mb-4" />
          <div className="h-4 w-64 bg-gray-100 rounded" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen space-y-6">
        {/* Page header */}
        <EventsPageHeader isAdmin={isAdmin} />

        {/* Stats row — 2 role-aware cards */}
        <StatsRow isAdmin={isAdmin} />

        {isAdmin ? (
          /* Admin: two-column — My Events left, Approval Queue right */
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-8">
            <div>
              <MyEventsPanel isAdmin />
            </div>
            <div>
              <ApprovalQueue />
            </div>
          </div>
        ) : (
          /* Non-admin: full-width My Events */
          <MyEventsPanel isAdmin={false} />
        )}
      </div>
    </DashboardLayout>
  )
}
