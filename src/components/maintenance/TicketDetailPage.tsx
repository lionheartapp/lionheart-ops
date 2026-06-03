'use client'

import { useRef, useState, type ReactNode } from 'react'
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
  SplitSquareHorizontal,
  Type,
  Bold,
  List,
  FileText,
  Pencil,
  Save,
} from 'lucide-react'
import { fetchApi, getAuthHeaders } from '@/lib/api-client'
import { useToast } from '@/components/Toast'
import { usePermissions } from '@/lib/hooks/usePermissions'
import { useAuth } from '@/lib/hooks/useAuth'
import { staggerContainer, fadeInUp, expandCollapse } from '@/lib/animations'
import TicketStatusTracker from './TicketStatusTracker'
import TicketActivityFeed from './TicketActivityFeed'
import HoldReasonInlineForm from './HoldReasonInlineForm'
import QACompletionModal from './QACompletionModal'
import QAReviewPanel from './QAReviewPanel'
import LaborTimerButton from './LaborTimerButton'
import PmChecklistSection from './PmChecklistSection'
import TicketDetailSidebar from './TicketDetailSidebar'
import SplitTicketDrawer from './SplitTicketDrawer'
import AIDiagnosticPanel from './AIDiagnosticPanel'
import PanelErrorBoundary from '@/components/PanelErrorBoundary'
import { Textarea } from '@/components/ui/Textarea'

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
  estimatedRepairCostUSD?: number | null
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
  asset?: {
    repeatAlertSentAt?: string | null
    costAlertSentAt?: string | null
    eolAlertSentAt?: string | null
  } | null
  watchers?: {
    id: string
    userId: string
    user: { id: string; firstName: string; lastName: string; email: string }
  }[]
  activities?: {
    id: string
    type: string
    content: string | null
    createdAt: string
    actor?: { firstName: string; lastName: string } | null
  }[]
}

interface TicketDetailPageProps {
  ticketId: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

import { STATUS_BADGE_COLORS, STATUS_LABELS } from '@/lib/constants/maintenance'

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

// ─── Key Details ─────────────────────────────────────────────────────────────

function KeyDetailsSection({
  ticketId,
  description,
  photos,
  canEdit,
  onPhotoClick,
  leoSlot,
}: {
  ticketId: string
  description?: string | null
  photos: string[]
  canEdit: boolean
  onPhotoClick: (url: string) => void
  leoSlot?: ReactNode
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(description ?? '')

  const updateMutation = useMutation({
    mutationFn: (nextDescription: string | null) =>
      fetchApi(`/api/maintenance/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ description: nextDescription }),
      }),
    onSuccess: () => {
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['maintenance-ticket', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['maintenance-ticket-activities', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['maintenance-tickets'] })
      toast('Description updated', 'success')
    },
    onError: () => {
      toast('Could not update description', 'error')
    },
  })

  function startEditing() {
    if (!canEdit) return
    setDraft(description ?? '')
    setEditing(true)
    setTimeout(() => editorRef.current?.focus(), 0)
  }

  function cancelEditing() {
    setDraft(description ?? '')
    setEditing(false)
  }

  function saveDescription() {
    updateMutation.mutate(draft.trim() ? draft.trim() : null)
  }

  function insertFormat(type: 'heading' | 'bold' | 'bullet') {
    const textarea = editorRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = draft.slice(start, end)
    let replacement = selected
    let cursorStart = start
    let cursorEnd = end

    if (type === 'heading') {
      replacement = selected
        ? selected.split('\n').map((line) => line.startsWith('## ') ? line : `## ${line}`).join('\n')
        : '## Heading'
      cursorStart = start + 3
      cursorEnd = start + replacement.length
    }

    if (type === 'bold') {
      replacement = selected ? `**${selected}**` : '**bold text**'
      cursorStart = selected ? start + 2 : start + 2
      cursorEnd = selected ? end + 2 : start + replacement.length - 2
    }

    if (type === 'bullet') {
      replacement = selected
        ? selected.split('\n').map((line) => line.startsWith('- ') ? line : `- ${line}`).join('\n')
        : '- List item'
      cursorStart = selected ? start : start + 2
      cursorEnd = start + replacement.length
    }

    const next = `${draft.slice(0, start)}${replacement}${draft.slice(end)}`
    setDraft(next)
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(cursorStart, cursorEnd)
    }, 0)
  }

  return (
    <section className="ui-glass p-5 rounded-2xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-400" />
          <h2 className="text-base font-semibold text-slate-900">Key Details</h2>
        </div>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={startEditing}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
          Description
        </p>

        {editing ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-1 border-b border-slate-100 bg-slate-50/80 px-2 py-2">
              <button
                type="button"
                onClick={() => insertFormat('heading')}
                className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-slate-500 hover:bg-white hover:text-slate-900 transition-colors cursor-pointer"
                title="Heading"
              >
                <Type className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => insertFormat('bold')}
                className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-slate-500 hover:bg-white hover:text-slate-900 transition-colors cursor-pointer"
                title="Bold"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => insertFormat('bullet')}
                className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-slate-500 hover:bg-white hover:text-slate-900 transition-colors cursor-pointer"
                title="Bulleted list"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            <Textarea
              ref={editorRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Add the background, symptoms, what has already been tried, and any safety notes..."
              rows={8}
              className="min-h-[220px] rounded-none border-0 bg-white px-4 py-4 text-sm leading-7 text-slate-800 shadow-none focus-visible:ring-0"
            />
            <div className="flex items-center gap-2 border-t border-slate-100 bg-white px-3 py-3">
              <button
                type="button"
                onClick={saveDescription}
                disabled={updateMutation.isPending}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save
              </button>
              <button
                type="button"
                onClick={cancelEditing}
                disabled={updateMutation.isPending}
                className="inline-flex min-h-10 items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-60 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={startEditing}
            disabled={!canEdit}
            className={`w-full rounded-xl border border-transparent p-3 text-left transition-colors ${
              canEdit
                ? 'hover:border-slate-200 hover:bg-slate-50 cursor-text'
                : 'cursor-default'
            }`}
          >
            {description ? (
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {description}
              </p>
            ) : (
              <p className="text-sm text-slate-400">
                No description yet.
                {canEdit ? ' Click to add the work order background.' : ''}
              </p>
            )}
          </button>
        )}
      </div>

      {photos.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-2">
            <ImageIcon className="w-3 h-3" />
            {photos.length} photo{photos.length !== 1 ? 's' : ''}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {photos.map((url, index) => (
              <button
                key={url}
                onClick={() => onPhotoClick(url)}
                className="relative w-20 h-20 rounded-xl overflow-hidden bg-slate-100 cursor-pointer hover:opacity-90 transition-opacity group flex-shrink-0"
                title="Click to view full size"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Photo ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <ExternalLink className="w-3 h-3 text-white opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity drop-shadow" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {leoSlot && (
        <div className="border-t border-slate-100 pt-4">
          {leoSlot}
        </div>
      )}
    </section>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TicketDetailPage({ ticketId }: TicketDetailPageProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: perms } = usePermissions()
  const { user: authUser } = useAuth()

  const { toast } = useToast()
  const canManage = perms?.canManageMaintenance ?? false
  const canClaim = perms?.canClaimMaintenance ?? false
  const canApproveQA = perms?.canApproveQA ?? false
  const isPrivileged = canManage || canClaim

  // UI state
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [showHoldForm, setShowHoldForm] = useState(false)
  const [showQAModal, setShowQAModal] = useState(false)
  const [showCancelForm, setShowCancelForm] = useState(false)
  const [showSplitDrawer, setShowSplitDrawer] = useState(false)
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
      setCancellationReason('')
      setIsCancelling(false)
      toast('Ticket cancelled', 'success')
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
  const currentUserId = authUser.id ?? ''
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
  const canSplit = canManage && ticket.status !== 'DONE' && ticket.status !== 'CANCELLED'
  const showActionBar =
    availableActions.length > 0 || showOnHoldAction || canCancel || canSplit
  const roomLabel = ticket.room
    ? ticket.room.displayName || ticket.room.roomNumber || 'Room'
    : null
  const locationLabel = [
    ticket.school?.name,
    ticket.building?.name,
    ticket.area?.name,
    roomLabel,
  ].filter(Boolean).join(' / ')
  const submittedByName = `${ticket.submittedBy.firstName} ${ticket.submittedBy.lastName}`.trim()
  const assignedToName = ticket.assignedTo
    ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}`.trim()
    : null
  const ticketComments = (ticket.activities ?? [])
    .filter((activity) => activity.type === 'COMMENT')
    .map((activity) => ({
      content: activity.content,
      createdAt: activity.createdAt,
      actorName: activity.actor
        ? `${activity.actor.firstName} ${activity.actor.lastName}`.trim()
        : null,
    }))

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

      <SplitTicketDrawer
        open={showSplitDrawer}
        ticketId={ticket.id}
        sourceTitle={ticket.title}
        sourcePriority={ticket.priority}
        sourceCategory={ticket.category}
        hasPhotos={(ticket.photos ?? []).length > 0}
        hasAsset={!!ticket.asset}
        onClose={() => setShowSplitDrawer(false)}
        onSplit={(newTicket) => {
          setShowSplitDrawer(false)
          toast(`Created ${newTicket.ticketNumber}`, 'success')
          queryClient.invalidateQueries({ queryKey: ['maintenance-ticket', ticketId] })
          queryClient.invalidateQueries({ queryKey: ['maintenance-ticket-activities', ticketId] })
          queryClient.invalidateQueries({ queryKey: ['maintenance-tickets'] })
          router.push(`/maintenance/tickets/${newTicket.id}`)
        }}
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
                onClick={() => router.push('/maintenance/work-orders')}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-slate-500 hover:text-slate-700 flex-shrink-0"
                title="Back to Work Orders"
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
                      STATUS_BADGE_COLORS[ticket.status] ?? 'bg-slate-100 text-slate-600'
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
        {showActionBar && (
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
                  aria-busy={statusMutation.isPending}
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

            {canSplit && (
              <button
                onClick={() => setShowSplitDrawer(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
              >
                <SplitSquareHorizontal className="w-3.5 h-3.5" />
                Split
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
                  <Textarea
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                    placeholder="Explain why this ticket is being cancelled..."
                    rows={2}
                    className="border-red-200 text-sm focus:border-red-400 focus:ring-red-100"
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
            <PanelErrorBoundary label="QA Review">
              <QAReviewPanel ticket={ticket} onComplete={onStatusActionComplete} />
            </PanelErrorBoundary>
          </motion.div>
        )}

        {/* ─── Two-column: Activity (left) | Sidebar (right) ─────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ─── Left: Key details + Activity ──────────────────────── */}
          <motion.div
            variants={staggerContainer(0.05, 0)}
            className="lg:col-span-2 space-y-4"
          >
            <motion.div variants={fadeInUp}>
              <KeyDetailsSection
                ticketId={ticket.id}
                description={ticket.description}
                photos={ticket.photos ?? []}
                canEdit={isPrivileged || isSubmitter}
                onPhotoClick={setLightboxUrl}
                leoSlot={
                  <AIDiagnosticPanel
                    ticketId={ticket.id}
                    ticketNumber={ticket.ticketNumber}
                    title={ticket.title}
                    description={ticket.description}
                    status={ticket.status}
                    priority={ticket.priority}
                    photos={ticket.photos}
                    category={ticket.category}
                    locationLabel={locationLabel || null}
                    submittedByName={submittedByName || null}
                    assignedToName={assignedToName}
                    comments={ticketComments}
                  />
                }
              />
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
              <PanelErrorBoundary label="Activity Feed">
                <TicketActivityFeed ticketId={ticketId} isPrivileged={isPrivileged} />
              </PanelErrorBoundary>
            </motion.div>
          </motion.div>

          {/* ─── Right: Sidebar ──────────────────────────────────── */}
          <motion.div variants={fadeInUp} className="lg:col-span-1">
            <div className="ui-glass p-5 rounded-2xl lg:sticky lg:top-4">
              <PanelErrorBoundary label="Ticket Details">
                <TicketDetailSidebar
                  ticket={ticket}
                  canManage={canManage}
                  canAssign={canManage}
                  isPrivileged={isPrivileged}
                  currentUserId={currentUserId}
                />
              </PanelErrorBoundary>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </>
  )
}
