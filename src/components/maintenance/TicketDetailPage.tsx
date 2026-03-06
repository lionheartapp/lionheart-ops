'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  MapPin,
  User,
  Mail,
  Clock,
  AlertCircle,
  Calendar,
  CheckCircle2,
  X,
  ExternalLink,
  Loader2,
  UserCheck,
  UserX,
  Pause,
  PlayCircle,
  CheckSquare,
  XCircle,
  ChevronRight,
  Wrench,
} from 'lucide-react'
import { fetchApi, getAuthHeaders } from '@/lib/api-client'
import { usePermissions } from '@/lib/hooks/usePermissions'
import { staggerContainer, fadeInUp, expandCollapse } from '@/lib/animations'
import TicketStatusTracker from './TicketStatusTracker'
import TicketActivityFeed from './TicketActivityFeed'
import HoldReasonInlineForm from './HoldReasonInlineForm'
import QACompletionModal from './QACompletionModal'
import QAReviewPanel from './QAReviewPanel'
import AIDiagnosticPanel from './AIDiagnosticPanel'
import PPESafetyPanel from './PPESafetyPanel'
import LaborTimerButton from './LaborTimerButton'
import LaborCostPanel from './LaborCostPanel'
import PmChecklistSection from './PmChecklistSection'
import type { AiAnalysisCache } from '@/lib/types/maintenance-ai'

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
  BACKLOG: 'bg-gray-100 text-gray-600',
  TODO: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  ON_HOLD: 'bg-orange-100 text-orange-700',
  SCHEDULED: 'bg-purple-100 text-purple-700',
  QA: 'bg-pink-100 text-pink-700',
  DONE: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-gray-100 text-gray-400',
}

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700',
  HIGH: 'bg-orange-100 text-orange-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW: 'bg-gray-100 text-gray-500',
}

const CATEGORY_LABELS: Record<string, string> = {
  ELECTRICAL: 'Electrical',
  PLUMBING: 'Plumbing',
  HVAC: 'HVAC',
  STRUCTURAL: 'Structural',
  CUSTODIAL_BIOHAZARD: 'Custodial / Biohazard',
  IT_AV: 'IT / A/V',
  GROUNDS: 'Grounds',
  OTHER: 'Other',
}

// Client-side allowed transitions mirror — simplified for action button display
// Only shows transitions relevant to a tech/head performing work
const ACTION_TRANSITIONS: Record<MaintenanceStatus, { to: MaintenanceStatus; label: string; icon: typeof PlayCircle }[]> = {
  BACKLOG: [{ to: 'TODO', label: 'Move to To Do', icon: PlayCircle }],
  TODO: [{ to: 'IN_PROGRESS', label: 'Start Work', icon: PlayCircle }],
  IN_PROGRESS: [{ to: 'QA', label: 'Move to QA', icon: CheckSquare }],
  ON_HOLD: [{ to: 'IN_PROGRESS', label: 'Resume Work', icon: PlayCircle }],
  QA: [],
  SCHEDULED: [{ to: 'TODO', label: 'Move to To Do', icon: PlayCircle }],
  DONE: [],
  CANCELLED: [],
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const secs = Math.floor(ms / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`
  const days = Math.floor(hrs / 24)
  return `${days} day${days !== 1 ? 's' : ''} ago`
}

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
  // Local checklist done state — updated optimistically from PmChecklistSection
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

  // Simple status transition mutation (no extra fields)
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
        {/* Header skeleton */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-200 rounded-lg" />
          <div className="h-6 bg-gray-200 rounded w-32" />
          <div className="h-5 bg-gray-100 rounded w-16 ml-2" />
        </div>
        {/* Two-column skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="ui-glass p-5 rounded-2xl space-y-3">
                <div className="h-4 bg-gray-200 rounded w-24" />
                <div className="h-3 bg-gray-100 rounded w-full" />
                <div className="h-3 bg-gray-100 rounded w-3/4" />
              </div>
            ))}
          </div>
          <div className="lg:col-span-3 space-y-4">
            <div className="ui-glass p-5 rounded-2xl h-24" />
            <div className="ui-glass p-5 rounded-2xl h-64" />
          </div>
        </div>
      </div>
    )
  }

  if (isError || !ticket) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-700 font-medium">Ticket not found</p>
        <p className="text-sm text-gray-500 mt-1">This ticket may have been deleted or you may not have permission to view it.</p>
        <button
          onClick={() => router.push('/maintenance')}
          className="mt-4 text-sm text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer"
        >
          Back to Maintenance
        </button>
      </div>
    )
  }

  // Derive user context
  const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('user-id') ?? '' : ''
  const isSubmitter = ticket.submittedById === currentUserId
  const canChangeStatus = (isPrivileged) && ticket.status !== 'DONE' && ticket.status !== 'CANCELLED'
  const canCancel = canManage && ticket.status !== 'DONE' && ticket.status !== 'CANCELLED'

  // Available actions for current status
  const availableActions = (canChangeStatus && !isSubmitter)
    ? ACTION_TRANSITIONS[ticket.status] ?? []
    : []

  const showQAReview = ticket.status === 'QA' && canApproveQA
  const showOnHoldAction = canChangeStatus && !isSubmitter && ticket.status !== 'ON_HOLD'
    && ['TODO', 'IN_PROGRESS', 'BACKLOG'].includes(ticket.status)
    && ticket.status !== 'QA'

  // Room display
  const roomLabel = ticket.room
    ? ticket.room.displayName || ticket.room.roomNumber || 'Room'
    : null

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
        className="space-y-6"
        initial="hidden"
        animate="visible"
        variants={staggerContainer(0.06, 0.02)}
      >
        {/* Page header */}
        <motion.div variants={fadeInUp} className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer text-gray-500 hover:text-gray-700"
              title="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                  {ticket.ticketNumber}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[ticket.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {STATUS_LABELS[ticket.status] ?? ticket.status}
                </span>
                {ticket.pmScheduleId && (
                  <a
                    href="/maintenance/pm-calendar"
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors font-medium cursor-pointer"
                    title="View PM schedule"
                  >
                    <Wrench className="w-3 h-3" />
                    PM Schedule
                  </a>
                )}
              </div>
              <h1 className="text-xl font-semibold text-gray-900 mt-1 leading-tight">
                {ticket.title}
              </h1>
            </div>
          </div>

          {/* Labor timer button — visible for privileged users on in-progress tickets */}
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
        </motion.div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ─── Left column (info) ──────────────────────────────────────── */}
          <motion.div variants={staggerContainer(0.05, 0)} className="lg:col-span-2 space-y-4">

            {/* Card 1: Submitter info */}
            <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4 text-gray-400" />
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Submitted By</h3>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-semibold text-emerald-700 flex-shrink-0">
                  {ticket.submittedBy.firstName[0]}{ticket.submittedBy.lastName[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {ticket.submittedBy.firstName} {ticket.submittedBy.lastName}
                  </p>
                  {ticket.submittedBy.userRole && (
                    <p className="text-xs text-gray-500">{ticket.submittedBy.userRole.name}</p>
                  )}
                  <a
                    href={`mailto:${ticket.submittedBy.email}`}
                    className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 transition-colors mt-0.5"
                  >
                    <Mail className="w-3 h-3" />
                    {ticket.submittedBy.email}
                  </a>
                </div>
              </div>

              {/* Timestamp */}
              <div className="flex items-center gap-2 text-xs text-gray-500 pt-1 border-t border-gray-100">
                <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  {formatAbsolute(ticket.createdAt)}{' '}
                  <span className="text-gray-400">({formatRelative(ticket.createdAt)})</span>
                </span>
              </div>

              {/* Availability note */}
              {ticket.availabilityNote && (
                <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">Availability Note</p>
                    <p className="text-xs text-amber-700 mt-0.5">{ticket.availabilityNote}</p>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Card 2: Location */}
            <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</h3>
              </div>

              {/* Hierarchy */}
              {(ticket.school || ticket.building || ticket.area || ticket.room) ? (
                <div className="space-y-1">
                  {ticket.school && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                      <span className="font-medium">{ticket.school.name}</span>
                      <span className="text-gray-400">Campus</span>
                    </div>
                  )}
                  {ticket.building && (
                    <div className={`flex items-center gap-1.5 text-xs text-gray-600 ${ticket.school ? 'pl-3' : ''}`}>
                      <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
                      <span>{ticket.building.name}</span>
                    </div>
                  )}
                  {ticket.area && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-600 pl-6">
                      <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
                      <span>{ticket.area.name}</span>
                    </div>
                  )}
                  {roomLabel && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-600 pl-9">
                      <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
                      <span className="font-medium">{roomLabel}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No location specified</p>
              )}

              {/* Google Maps link */}
              {ticket.building && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(ticket.building.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  View on Google Maps
                </a>
              )}
            </motion.div>

            {/* Card 3: Issue details */}
            <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Issue Details</h3>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                    {CATEGORY_LABELS[ticket.category] ?? ticket.category}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[ticket.priority] ?? 'bg-gray-100 text-gray-600'}`}>
                    {ticket.priority}
                  </span>
                </div>
              </div>

              {ticket.description && (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
              )}

              {/* Photos gallery */}
              {ticket.photos && ticket.photos.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">{ticket.photos.length} photo{ticket.photos.length !== 1 ? 's' : ''}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {ticket.photos.map((url, i) => (
                      <button
                        key={url}
                        onClick={() => setLightboxUrl(url)}
                        className="relative aspect-video rounded-xl overflow-hidden bg-gray-100 cursor-pointer hover:opacity-90 transition-opacity group"
                        title="Click to view full size"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Photo ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                          <ExternalLink className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!ticket.description && (!ticket.photos || ticket.photos.length === 0) && (
                <p className="text-xs text-gray-400">No additional details provided</p>
              )}
            </motion.div>

            {/* PM Checklist — only for PM-generated tickets */}
            {ticket.pmScheduleId && (ticket.pmChecklistItems ?? []).length > 0 && (
              <motion.div variants={fadeInUp}>
                <PmChecklistSection
                  ticketId={ticket.id}
                  checklistItems={ticket.pmChecklistItems ?? []}
                  checklistDone={localChecklistDone ?? ticket.pmChecklistDone ?? []}
                  canEdit={isPrivileged && !isSubmitter}
                  onUpdate={(updatedDone) => {
                    setLocalChecklistDone(updatedDone)
                    // Clear QA gate error if all done now
                    const items = ticket.pmChecklistItems ?? []
                    if (items.length === 0 || updatedDone.slice(0, items.length).every(Boolean)) {
                      setChecklistError('')
                    }
                  }}
                />
              </motion.div>
            )}

            {/* Card 4: Assignment */}
            <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl space-y-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-gray-400" />
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Assignment</h3>
              </div>

              {ticket.assignedTo ? (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700 flex-shrink-0">
                    {ticket.assignedTo.firstName[0]}{ticket.assignedTo.lastName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {ticket.assignedTo.firstName} {ticket.assignedTo.lastName}
                    </p>
                    <p className="text-xs text-gray-500">Assigned technician</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <UserX className="w-4 h-4" />
                  Unassigned
                </div>
              )}
            </motion.div>
          </motion.div>

          {/* ─── Right column (status + actions + activity) ──────────────── */}
          <motion.div variants={staggerContainer(0.05, 0.1)} className="lg:col-span-3 space-y-4">

            {/* Status tracker */}
            <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl">
              <TicketStatusTracker
                currentStatus={ticket.status}
                holdReason={ticket.holdReason}
                scheduledDate={ticket.scheduledDate}
              />
            </motion.div>

            {/* Action buttons (privileged users — not submitter-only) */}
            {!isSubmitter && isPrivileged && ticket.status !== 'DONE' && ticket.status !== 'CANCELLED' && (
              <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</h3>

                {/* Primary status actions */}
                {availableActions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {availableActions.map(({ to, label }) => {
                      const isQATransition = to === 'QA'
                      return (
                        <button
                          key={to}
                          onClick={() => {
                            if (isQATransition) {
                              // Client-side PM checklist pre-check
                              if (ticket.pmScheduleId) {
                                const items = ticket.pmChecklistItems ?? []
                                const done = localChecklistDone ?? ticket.pmChecklistDone ?? []
                                const allDone = items.length === 0 || done.slice(0, items.length).every(Boolean)
                                if (!allDone) {
                                  setChecklistError('Complete all PM checklist items before moving to QA')
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
                          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
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
                  </div>
                )}

                {/* On Hold button */}
                {showOnHoldAction && (
                  <div>
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

                    <AnimatePresence>
                      {showHoldForm && (
                        <HoldReasonInlineForm
                          ticketId={ticketId}
                          onComplete={onStatusActionComplete}
                          onCancel={() => setShowHoldForm(false)}
                        />
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Cancel button (Head/Admin only) */}
                {canCancel && (
                  <div>
                    <button
                      onClick={() => setShowCancelForm((v) => !v)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border transition-colors cursor-pointer ${
                        showCancelForm
                          ? 'bg-red-50 border-red-300 text-red-700'
                          : 'bg-white border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300'
                      }`}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Cancel Ticket
                    </button>

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
                          <div className="mt-2 p-4 bg-red-50/80 border border-red-200 rounded-xl space-y-3">
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
                                className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm bg-white resize-none focus:outline-none focus:ring-2 focus:ring-red-400 placeholder:text-gray-400"
                              />
                            </div>
                            {cancelError && (
                              <p className="text-xs text-red-600">{cancelError}</p>
                            )}
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
                                onClick={() => { setShowCancelForm(false); setCancellationReason('') }}
                                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                                Cancel
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Status transition error */}
                {statusMutation.isError && (
                  <p className="text-xs text-red-600">
                    {statusMutation.error instanceof Error ? statusMutation.error.message : 'Failed to update status'}
                  </p>
                )}

                {/* PM checklist gate error */}
                {checklistError && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
                    <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    <p className="text-xs text-red-700">{checklistError}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Scheduled date info banner */}
            {ticket.status === 'SCHEDULED' && ticket.scheduledDate && (
              <motion.div variants={fadeInUp} className="flex items-center gap-3 px-4 py-3 bg-purple-50 border border-purple-200 rounded-2xl">
                <Calendar className="w-4 h-4 text-purple-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-purple-800">Scheduled for {formatDate(ticket.scheduledDate)}</p>
                  <p className="text-xs text-purple-600">Will automatically move to Backlog on this date</p>
                </div>
              </motion.div>
            )}

            {/* Completed/cancelled banner */}
            {(ticket.status === 'DONE' || ticket.status === 'CANCELLED') && (
              <motion.div variants={fadeInUp} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${ticket.status === 'DONE' ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                {ticket.status === 'DONE' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <p className="text-sm font-medium text-emerald-800">Ticket completed and closed</p>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <p className="text-sm font-medium text-gray-600">Ticket has been cancelled</p>
                  </>
                )}
              </motion.div>
            )}

            {/* QA Review Panel (Head only when ticket is in QA status) */}
            {showQAReview && (
              <motion.div variants={fadeInUp}>
                <QAReviewPanel
                  ticket={ticket}
                  onComplete={onStatusActionComplete}
                />
              </motion.div>
            )}

            {/* PPE & Safety Panel (Custodial/Biohazard tickets only) */}
            {ticket.category === 'CUSTODIAL_BIOHAZARD' && (
              <motion.div variants={fadeInUp}>
                <PPESafetyPanel category={ticket.category} />
              </motion.div>
            )}

            {/* AI Diagnostics Panel (lazy-loads on expand) */}
            <motion.div variants={fadeInUp}>
              <AIDiagnosticPanel
                ticketId={ticket.id}
                photos={ticket.photos}
                category={ticket.category}
                aiAnalysis={ticket.aiAnalysis as AiAnalysisCache | null}
              />
            </motion.div>

            {/* Labor & Cost tracking panel (visible to privileged users on all ticket statuses) */}
            {isPrivileged && (
              <motion.div variants={fadeInUp}>
                <LaborCostPanel
                  ticketId={ticket.id}
                  currentUserId={currentUserId}
                />
              </motion.div>
            )}

            {/* Activity feed */}
            <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-sm font-semibold text-gray-700">Activity</h3>
                <button
                  onClick={() => refetch()}
                  className="ml-auto text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                >
                  Refresh
                </button>
              </div>
              <TicketActivityFeed
                ticketId={ticketId}
                isPrivileged={isPrivileged}
              />
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </>
  )
}
