'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  X,
  ExternalLink,
  Loader2,
  Pause,
  PlayCircle,
  CheckSquare,
  XCircle,
  Wrench,
  ImageIcon,
} from 'lucide-react'
import { fetchApi, getAuthHeaders } from '@/lib/api-client'
import { usePermissions } from '@/lib/hooks/usePermissions'
import { staggerContainer, fadeInUp, expandCollapse } from '@/lib/animations'
import TicketStatusTracker from './TicketStatusTracker'
import TicketActivityFeed from './TicketActivityFeed'
import HoldReasonInlineForm from './HoldReasonInlineForm'
import QACompletionModal from './QACompletionModal'
import QAReviewPanel from './QAReviewPanel'
import LaborTimerButton from './LaborTimerButton'
import PmChecklistSection from './PmChecklistSection'
import TicketDetailSidebar from './TicketDetailSidebar'

// ─── Types ───────────────────────────────────────────────────────────────────

type MaintenanceStatus =
  | 'BACKLOG'
  | 'TODO'
  | 'IN_PROGRESS'
  | 'QA'
  | 'DONE'
  | 'ON_HOLD'
  | 'SCHEDULED'
  | 'CANCELLED'

type HoldReason = 'PARTS' | 'VENDOR' | 'ACCESS' | 'OTHER'

interface MaintenanceTicket {
  id: string
  ticketNumber: string
  title: string
  description?: string | null
  status: MaintenanceStatus
  priority: string
  category: string
  photos: string[]
  aiAnalysis?: unknown | null
  completionPhotos?: string[]
  completionNote?: string | null
  holdReason?: HoldReason | null
  holdNote?: string | null
  scheduledDate?: string | null
  availabilityNote?: string | null
  createdAt: string
  submittedById: string
  // PM fields
  pmScheduleId?: string | null
  pmScheduledDueDate?: string | null
  pmChecklistItems?: string[]
  pmChecklistDone?: boolean[]
  submittedBy: {
    id: string
    firstName: string
    lastName: string
    email: string
    userRole?: { name: string } | null
  }
  assignedTo?: {
    id: string
    firstName: string
    lastName: string
  } | null
  building?: { id: string; name: string } | null
  area?: { id: string; name: string } | null
  room?: { id: string; roomNumber: string; displayName?: string | null } | null
  school?: { id: string; name: string } | null
  laborEntries?: { id: string; hoursWorked: number; hourlyRate?: number | null }[]
  costEntries?: { id: string; amount: number; description?: string | null }[]
  watchers?: {
    id: string
    userId: string
    user: { id: string; firstName: string; lastName: string; email: string }
  }[]
}

interface TicketDetailPageProps {
  ticketId: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  BACKLOG: 'Backlog',
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'On Hold',
  SCHEDULED: 'Scheduled',
  QA: 'QA Review',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
}

const STATUS_COLORS: Record<string, string> = {
  BACKLOG: 'bg-slate-100 text-slate-600',
  TODO: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  ON_HOLD: 'bg-orange-100 text-orange-700',
  SCHEDULED: 'bg-purple-100 text-purple-700',
  QA: 'bg-pink-100 text-pink-700',
  DONE: 'bg-primary-100 text-primary-700',
  CANCELLED: 'bg-slate-100 text-slate-400',
}

// Client-side allowed transitions — simplified for action button display
const ACTION_TRANSITIONS: Record<MaintenanceStatus, { to: MaintenanceStatus; label: string }[]> = {
  BACKLOG: [{ to: 'TODO', label: 'Move to To Do' }],
  TODO: [{ to: 'IN_PROGRESS', label: 'Start Work' }],
  IN_PROGRESS: [{ to: 'QA', label: 'Move to QA' }],
  ON_HOLD: [{ to: 'IN_PROGRESS', label: 'Resume Work' }],
  QA: [],
  SCHEDULED: [{ to: 'TODO', label: 'Move to To Do' }],
  DONE: [],
  CANCELLED: [],
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Full size view"
        className="max-w-full max-h-full object-contain rounded-xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TicketDetailPage({ ticketId }: TicketDetailPageProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: perms } = usePermissions()

  const canManage = perms?.canManageMaintenance ?? false
  const canClaim = perms?.canClaimMaintenance ?? false
  const canApproveQA = perms?.canApproveQA ?? false
  const isPrivileged = canManage || canClaim

  // UI state
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [showHoldForm, setShowHoldForm] = useState(false)
  const [showQAModal, setShowQAModal] = useState(false)
  const [showCancelForm, setShowCancelForm] = useState(false)
  const [cancellationReason, setCancellationReason] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [checklistError, setChecklistError] = useState('')
  const [localChecklistDone, setLocalChecklistDone] = useState<boolean[] | null>(null)

  // Ticket query
  const {
    data: ticket,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['maintenance-ticket', ticketId],
    queryFn: () => fetchApi<MaintenanceTicket>(`/api/maintenance/tickets/${ticketId}`),
    staleTime: 30 * 1000,
  })

  // Status transition mutation
  const statusMutation = useMutation({
    mutationFn: (newStatus: MaintenanceStatus) =>
      fetchApi(`/api/maintenance/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-ticket', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['maintenance-ticket-activities', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['maintenance-tickets'] })
    },
  })

  async function handleCancelTicket() {
    if (!cancellationReason.trim()) return
    setIsCancelling(true)
    setCancelError('')
    try {
      await fetchApi(`/api/maintenance/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: 'CANCELLED', cancellationReason: cancellationReason.trim() }),
      })
      setShowCancelForm(false)
      queryClient.invalidateQueries({ queryKey: ['maintenance-ticket', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['maintenance-ticket-activities', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['maintenance-tickets'] })
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Failed to cancel ticket.')
      setIsCancelling(false)
    }
  }

  function onStatusActionComplete() {
    setShowHoldForm(false)
    setShowQAModal(false)
    queryClient.invalidateQueries({ queryKey: ['maintenance-ticket', ticketId] })
    queryClient.invalidateQueries({ queryKey: ['maintenance-ticket-activities', ticketId] })
    queryClient.invalidateQueries({ queryKey: ['maintenance-tickets'] })
  }

  // ─── Loading / Error states ─────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-200 rounded-lg" />
          <div className="h-6 bg-slate-200 rounded w-32" />
          <div className="h-5 bg-slate-100 rounded w-16 ml-2" />
        </div>
        <div className="h-12 bg-slate-100 rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="ui-glass p-5 rounded-2xl h-32" />
            <div className="ui-glass p-5 rounded-2xl h-64" />
          </div>
          <div className="space-y-4">
            <div className="ui-glass p-5 rounded-2xl h-24" />
            <div className="ui-glass p-5 rounded-2xl h-48" />
          </div>
        </div>
      </div>
    )
  }

  if (isError || !ticket) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-700 font-medium">Ticket not found</p>
        <p className="text-sm text-slate-500 mt-1">
          This ticket may have been deleted or you may not have permission to view it.
        </p>
        <button
          onClick={() => router.push('/maintenance')}
          className="mt-4 text-sm text-primary-600 hover:text-primary-700 transition-colors cursor-pointer"
        >
          Back to Maintenance
        </button>
      </div>
    )
  }

  // Derived state
  const currentUserId =
    typeof window !== 'undefined' ? localStorage.getItem('user-id') ?? '' : ''
  const isSubmitter = ticket.submittedById === currentUserId
  const canChangeStatus =
    isPrivileged && ticket.status !== 'DONE' && ticket.status !== 'CANCELLED'
  const canCancel = canManage && ticket.status !== 'DONE' && ticket.status !== 'CANCELLED'

  const availableActions =
    canChangeStatus && !isSubmitter ? ACTION_TRANSITIONS[ticket.status] ?? [] : []

  const showQAReview = ticket.status === 'QA' && canApproveQA
  const showOnHoldAction =
    canChangeStatus &&
    !isSubmitter &&
    ticket.status !== 'ON_HOLD' &&
    ['TODO', 'IN_PROGRESS', 'BACKLOG'].includes(ticket.status) &&
    ticket.status !== 'QA'

  return (
    <>
      {lightboxUrl && (
        <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}

      <QACompletionModal
        ticketId={ticketId}
        open={showQAModal}
        onClose={() => setShowQAModal(false)}
        onComplete={onStatusActionComplete}
      />

      <motion.div
        className="space-y-5"
        initial="hidden"
        animate="visible"
        variants={staggerContainer(0.06, 0.02)}
      >
        {/* ─── Header ─────────────────────────────────────────────────── */}
        <motion.div variants={fadeInUp}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => router.back()}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-slate-500 hover:text-slate-700 flex-shrink-0"
                title="Go back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                    {ticket.ticketNumber}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      STATUS_COLORS[ticket.status] ?? 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {STATUS_LABELS[ticket.status] ?? ticket.status}
                  </span>
                  {ticket.pmScheduleId && (
                    <a
                      href="/maintenance/pm-calendar"
                      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary-50 border border-primary-200 text-primary-700 hover:bg-primary-100 transition-colors font-medium cursor-pointer"
                      title="View PM schedule"
                    >
                      <Wrench className="w-3 h-3" />
                      PM
                    </a>
                  )}
                </div>
                <h1 className="text-xl font-semibold text-slate-900 mt-1 leading-tight truncate">
                  {ticket.title}
                </h1>
              </div>
            </div>

            {/* Labor timer — top right for in-progress tickets */}
            {isPrivileged && !isSubmitter && ticket.status === 'IN_PROGRESS' && (
              <LaborTimerButton
                ticketId={ticket.id}
                currentUserId={currentUserId}
                onEntryCreated={() => {
                  queryClient.invalidateQueries({ queryKey: ['labor-entries', ticket.id] })
                  queryClient.invalidateQueries({ queryKey: ['cost-summary', ticket.id] })
                }}
              />
            )}
          </div>

          {/* Status tracker */}
          <div className="mt-4">
            <TicketStatusTracker
              currentStatus={ticket.status}
              holdReason={ticket.holdReason}
              scheduledDate={ticket.scheduledDate}
            />
          </div>
        </motion.div>

        {/* ─── Actions bar ─────────────────────────────────────────── */}
        {!isSubmitter && isPrivileged && ticket.status !== 'DONE' && ticket.status !== 'CANCELLED' && (
          <motion.div variants={fadeInUp} className="flex items-center gap-2 flex-wrap">
            {/* Primary actions */}
            {availableActions.map(({ to, label }) => {
              const isQATransition = to === 'QA'
              return (
                <button
                  key={to}
                  onClick={() => {
                    if (isQATransition) {
                      if (ticket.pmScheduleId) {
                        const items = ticket.pmChecklistItems ?? []
                        const done = localChecklistDone ?? ticket.pmChecklistDone ?? []
                        const allDone =
                          items.length === 0 || done.slice(0, items.length).every(Boolean)
                        if (!allDone) {
                          setChecklistError(
                            'Complete all PM checklist items before moving to QA'
                          )
                          return
                        }
                      }
                      setChecklistError('')
                      setShowQAModal(true)
                    } else {
                      statusMutation.mutate(to)
                    }
                  }}
                  disabled={statusMutation.isPending}
                  className="ui-btn-md ui-btn-primary"
                >
                  {statusMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <PlayCircle className="w-3.5 h-3.5" />
                  )}
                  {label}
                </button>
              )
            })}

            {showOnHoldAction && (
              <button
                onClick={() => setShowHoldForm((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border transition-colors cursor-pointer ${
                  showHoldForm
                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                    : 'bg-white border-amber-200 text-amber-600 hover:bg-amber-50 hover:border-amber-300'
                }`}
              >
                <Pause className="w-3.5 h-3.5" />
                On Hold
              </button>
            )}

            {canCancel && (
              <button
                onClick={() => setShowCancelForm((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border transition-colors cursor-pointer ${
                  showCancelForm
                    ? 'bg-red-50 border-red-300 text-red-700'
                    : 'bg-white border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300'
                }`}
              >
                <XCircle className="w-3.5 h-3.5" />
                Cancel
              </button>
            )}

            {statusMutation.isError && (
              <p className="text-xs text-red-600">
                {statusMutation.error instanceof Error
                  ? statusMutation.error.message
                  : 'Failed to update status'}
              </p>
            )}

            {checklistError && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                <p className="text-xs text-red-700">{checklistError}</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Hold form expanded */}
        <AnimatePresence>
          {showHoldForm && (
            <motion.div
              key="hold-form"
              variants={expandCollapse}
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              className="overflow-hidden"
            >
              <HoldReasonInlineForm
                ticketId={ticketId}
                onComplete={onStatusActionComplete}
                onCancel={() => setShowHoldForm(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cancel form expanded */}
        <AnimatePresence>
          {showCancelForm && (
            <motion.div
              key="cancel-form"
              variants={expandCollapse}
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              className="overflow-hidden"
            >
              <div className="p-4 bg-red-50/80 border border-red-200 rounded-xl space-y-3">
                <p className="text-xs font-semibold text-red-900">Cancel Ticket</p>
                <div>
                  <label className="block text-xs font-medium text-red-800 mb-1">
                    Cancellation Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                    placeholder="Explain why this ticket is being cancelled..."
                    rows={2}
                    className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm bg-white resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 placeholder:text-slate-400"
                  />
                </div>
                {cancelError && <p className="text-xs text-red-600">{cancelError}</p>}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCancelTicket}
                    disabled={!cancellationReason.trim() || isCancelling}
                    className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    {isCancelling ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5" />
                    )}
                    Confirm Cancellation
                  </button>
                  <button
                    onClick={() => {
                      setShowCancelForm(false)
                      setCancellationReason('')
                    }}
                    className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scheduled/completed/cancelled banners */}
        {ticket.status === 'SCHEDULED' && ticket.scheduledDate && (
          <motion.div
            variants={fadeInUp}
            className="flex items-center gap-3 px-4 py-3 bg-purple-50 border border-purple-200 rounded-2xl"
          >
            <CheckSquare className="w-4 h-4 text-purple-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-purple-800">
                Scheduled for {formatDate(ticket.scheduledDate)}
              </p>
              <p className="text-xs text-purple-600">
                Will automatically move to Backlog on this date
              </p>
            </div>
          </motion.div>
        )}

        {(ticket.status === 'DONE' || ticket.status === 'CANCELLED') && (
          <motion.div
            variants={fadeInUp}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${
              ticket.status === 'DONE'
                ? 'bg-primary-50 border-primary-200'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            {ticket.status === 'DONE' ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-primary-600 flex-shrink-0" />
                <p className="text-sm font-medium text-primary-800">
                  Ticket completed and closed
                </p>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <p className="text-sm font-medium text-slate-600">Ticket has been cancelled</p>
              </>
            )}
          </motion.div>
        )}

        {/* QA Review Panel */}
        {showQAReview && (
          <motion.div variants={fadeInUp}>
            <QAReviewPanel ticket={ticket} onComplete={onStatusActionComplete} />
          </motion.div>
        )}

        {/* ─── Two-column: Activity (left) | Sidebar (right) ─────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ─── Left: Issue brief + Activity ──────────────────────── */}
          <motion.div
            variants={staggerContainer(0.05, 0)}
            className="lg:col-span-2 space-y-4"
          >
            {/* Issue summary card */}
            <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl space-y-3">
              {ticket.description && (
                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                  {ticket.description}
                </p>
              )}

              {/* Photos */}
              {ticket.photos && ticket.photos.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
                    <ImageIcon className="w-3 h-3" />
                    {ticket.photos.length} photo{ticket.photos.length !== 1 ? 's' : ''}
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {ticket.photos.map((url, i) => (
                      <button
                        key={url}
                        onClick={() => setLightboxUrl(url)}
                        className="relative w-20 h-20 rounded-xl overflow-hidden bg-slate-100 cursor-pointer hover:opacity-90 transition-opacity group flex-shrink-0"
                        title="Click to view full size"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Photo ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                          <ExternalLink className="w-3 h-3 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!ticket.description &&
                (!ticket.photos || ticket.photos.length === 0) && (
                  <p className="text-xs text-slate-400">No additional details provided</p>
                )}
            </motion.div>

            {/* PM Checklist */}
            {ticket.pmScheduleId && (ticket.pmChecklistItems ?? []).length > 0 && (
              <motion.div variants={fadeInUp}>
                <PmChecklistSection
                  ticketId={ticket.id}
                  checklistItems={ticket.pmChecklistItems ?? []}
                  checklistDone={localChecklistDone ?? ticket.pmChecklistDone ?? []}
                  canEdit={isPrivileged && !isSubmitter}
                  onUpdate={(updatedDone) => {
                    setLocalChecklistDone(updatedDone)
                    const items = ticket.pmChecklistItems ?? []
                    if (
                      items.length === 0 ||
                      updatedDone.slice(0, items.length).every(Boolean)
                    ) {
                      setChecklistError('')
                    }
                  }}
                />
              </motion.div>
            )}

            {/* Activity feed */}
            <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-sm font-semibold text-slate-700">Activity</h3>
                <button
                  onClick={() => refetch()}
                  className="ml-auto text-xs text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  Refresh
                </button>
              </div>
              <TicketActivityFeed ticketId={ticketId} isPrivileged={isPrivileged} />
            </motion.div>
          </motion.div>

          {/* ─── Right: Sidebar ──────────────────────────────────── */}
          <motion.div variants={fadeInUp} className="lg:col-span-1">
            <div className="ui-glass p-5 rounded-2xl lg:sticky lg:top-4">
              <TicketDetailSidebar
                ticket={ticket}
                canManage={canManage}
                canAssign={canManage}
                isPrivileged={isPrivileged}
                currentUserId={currentUserId}
              />
            </div>
          </motion.div>
        </div>
      </motion.div>
    </>
  )
}
