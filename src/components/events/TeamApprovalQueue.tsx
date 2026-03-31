'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import {
  CalendarRange,
  CheckCircle2,
  XCircle,
  PartyPopper,
  Loader2,
  AlertCircle,
  Monitor,
  Wrench,
  StickyNote,
} from 'lucide-react'
import { usePendingGateApprovals, useApproveGate, useRejectGate, type EventProject } from '@/lib/hooks/useEventProject'
import { staggerContainer, cardEntrance, fadeInUp } from '@/lib/animations'
import { useToast } from '@/components/Toast'

// ─── Gate Labels ─────────────────────────────────────────────────────────────

const GATE_LABELS: Record<string, string> = {
  av: 'AV Production',
  facilities: 'Facilities',
  admin: 'Admin',
}

const GATE_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  PENDING: { label: 'Pending', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  APPROVED: { label: 'Approved', bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-400' },
  REJECTED: { label: 'Rejected', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' },
  SKIPPED: { label: 'Skipped', bg: 'bg-slate-50', text: 'text-slate-500', dot: 'bg-slate-300' },
}

// ─── Resource Requirements ───────────────────────────────────────────────────

function ResourceRequirements({
  project,
  gateType,
}: {
  project: EventProject
  gateType: 'av' | 'facilities' | 'admin'
}) {
  const meta = (project.metadata ?? {}) as Record<string, unknown>

  // Determine which requirements to show based on the gate type
  const isAV = gateType === 'av'
  const isFacilities = gateType === 'facilities'
  const isAdmin = gateType === 'admin'

  const avNeeds = (meta.avNeeds ?? []) as string[]
  const avNotes = (meta.avNotes ?? '') as string
  const facilityNeeds = (meta.facilityNeeds ?? []) as string[]
  const facilityNotes = (meta.facilityNotes ?? '') as string

  const hasAV = project.requiresAV && (avNeeds.length > 0 || avNotes)
  const hasFacilities = project.requiresFacilities && (facilityNeeds.length > 0 || facilityNotes)

  // For AV gate, show AV requirements; for facilities gate, show facilities; admin sees both
  const showAV = hasAV && (isAV || isAdmin)
  const showFacilities = hasFacilities && (isFacilities || isAdmin)

  if (!showAV && !showFacilities) {
    // If the gate exists but no specific needs were listed, show a simple indicator
    if ((isAV && project.requiresAV) || (isFacilities && project.requiresFacilities)) {
      return (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl mb-3">
          {isAV ? <Monitor className="w-3.5 h-3.5 text-blue-500" /> : <Wrench className="w-3.5 h-3.5 text-amber-500" />}
          <span className="text-xs text-slate-600">
            {isAV ? 'A/V support' : 'Facilities support'} requested — no specific details provided
          </span>
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-2 mb-3">
      {showAV && (
        <div className="bg-blue-50/70 border border-blue-100 rounded-xl px-3.5 py-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Monitor className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-semibold text-blue-800">A/V Requirements</span>
          </div>
          {avNeeds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {avNeeds.map((need) => (
                <span
                  key={need}
                  className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-medium"
                >
                  {need}
                </span>
              ))}
            </div>
          )}
          {avNotes && (
            <div className="flex items-start gap-1.5">
              <StickyNote className="w-3 h-3 text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-700 leading-relaxed">{avNotes}</p>
            </div>
          )}
        </div>
      )}

      {showFacilities && (
        <div className="bg-amber-50/70 border border-amber-100 rounded-xl px-3.5 py-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-semibold text-amber-800">Facilities Requirements</span>
          </div>
          {facilityNeeds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {facilityNeeds.map((need) => (
                <span
                  key={need}
                  className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium"
                >
                  {need}
                </span>
              ))}
            </div>
          )}
          {facilityNotes && (
            <div className="flex items-start gap-1.5">
              <StickyNote className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700 leading-relaxed">{facilityNotes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Approval Card ───────────────────────────────────────────────────────────

function ApprovalCard({
  project,
  gateType,
  onApprove,
  onReject,
  isApproving,
}: {
  project: EventProject
  gateType: 'av' | 'facilities' | 'admin'
  onApprove: (id: string) => void
  onReject: (id: string, reason: string) => void
  isApproving: boolean
}) {
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const startsAt = new Date(project.startsAt)
  const endsAt = new Date(project.endsAt)
  const dateDisplay = project.isMultiDay
    ? `${format(startsAt, 'MMM d')} – ${format(endsAt, 'MMM d, yyyy')}`
    : format(startsAt, 'MMM d, yyyy')

  const creatorName = project.createdBy?.firstName
    ? `${project.createdBy.firstName} ${project.createdBy.lastName || ''}`.trim()
    : project.createdBy?.email

  // Show other gate statuses
  const otherGates = project.approvalGates
    ? Object.entries(project.approvalGates)
        .filter(([key, v]) => key !== gateType && v != null)
        .map(([key, gate]) => ({ key, ...(gate as { status: string }) }))
    : []

  const handleReject = () => {
    if (!rejectReason.trim()) return
    onReject(project.id, rejectReason.trim())
    setShowRejectForm(false)
    setRejectReason('')
  }

  return (
    <motion.div variants={cardEntrance} className="ui-glass-hover p-5 rounded-2xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-sm font-semibold text-slate-900 flex-1 min-w-0 truncate">
          {project.title}
        </h3>
      </div>

      {project.description && (
        <p className="text-xs text-slate-500 mb-3 line-clamp-2">{project.description}</p>
      )}

      {/* Meta */}
      <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
        <div className="flex items-center gap-1">
          <CalendarRange className="w-3.5 h-3.5" />
          {dateDisplay}
        </div>
        {project.locationText && (
          <span className="truncate max-w-[140px]">{project.locationText}</span>
        )}
      </div>

      {creatorName && (
        <p className="text-xs text-slate-400 mb-3">Submitted by {creatorName}</p>
      )}

      {/* Other gate statuses */}
      {otherGates.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3">
          {otherGates.map(({ key, status }) => {
            const config = GATE_STATUS_CONFIG[status] ?? GATE_STATUS_CONFIG.PENDING
            return (
              <span
                key={key}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${config.bg} ${config.text}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                {(GATE_LABELS as Record<string, string>)[key] ?? key}: {config.label}
              </span>
            )
          })}
        </div>
      )}

      {/* Resource requirements — show what the team needs to review */}
      <ResourceRequirements project={project} gateType={gateType} />

      {/* Action buttons */}
      {!showRejectForm ? (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onApprove(project.id)}
            disabled={isApproving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-green-600 text-white text-xs font-medium hover:bg-green-700 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50"
          >
            {isApproving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            Approve
          </button>
          <button
            onClick={() => setShowRejectForm(true)}
            disabled={isApproving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50"
          >
            <XCircle className="w-3.5 h-3.5" />
            Reject
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection (required)..."
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 resize-none"
            rows={2}
            autoFocus
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleReject}
              disabled={!rejectReason.trim() || isApproving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-red-600 text-white text-xs font-medium hover:bg-red-700 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50"
            >
              {isApproving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm Rejection'}
            </button>
            <button
              onClick={() => { setShowRejectForm(false); setRejectReason('') }}
              className="px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function QueueSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl bg-slate-100 h-36" />
      ))}
    </div>
  )
}

// ─── TeamApprovalQueue ───────────────────────────────────────────────────────

interface TeamApprovalQueueProps {
  gateType: 'av' | 'facilities'
  teamLabel: string
}

export default function TeamApprovalQueue({ gateType, teamLabel }: TeamApprovalQueueProps) {
  const { data: projects, isLoading, isError } = usePendingGateApprovals(gateType)
  const { toast } = useToast()
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

  // We need to create a temporary wrapper for the mutation since the hook
  // requires an ID upfront but we need it per-card
  const handleApprove = async (projectId: string) => {
    setProcessingIds((prev) => new Set(prev).add(projectId))
    try {
      const res = await fetch(`/api/events/projects/${projectId}/approve-gate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gateType }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err?.error?.message || 'Failed to approve')
      }
      toast(`${teamLabel} approval granted`, 'success')
      // Refetch after a short delay
      window.dispatchEvent(new Event('focus'))
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to approve', 'error')
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(projectId)
        return next
      })
    }
  }

  const handleReject = async (projectId: string, reason: string) => {
    setProcessingIds((prev) => new Set(prev).add(projectId))
    try {
      const res = await fetch(`/api/events/projects/${projectId}/reject-gate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gateType, reason }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err?.error?.message || 'Failed to reject')
      }
      toast('Event sent back for revision', 'success')
      window.dispatchEvent(new Event('focus'))
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to reject', 'error')
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(projectId)
        return next
      })
    }
  }

  if (isLoading) return <QueueSkeleton />

  if (isError) {
    return (
      <div className="ui-glass p-6 text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-slate-600">Failed to load approval queue. Please refresh.</p>
      </div>
    )
  }

  if (!projects || projects.length === 0) {
    return (
      <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="ui-glass p-8 text-center">
        <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <PartyPopper className="w-6 h-6 text-green-500" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900">All clear!</h3>
        <p className="text-xs text-slate-500 mt-1">No events waiting for {teamLabel} approval.</p>
      </motion.div>
    )
  }

  return (
    <motion.div
      variants={staggerContainer(0.05)}
      initial="hidden"
      animate="visible"
      className="space-y-3"
    >
      <AnimatePresence mode="popLayout">
        {projects.map((project) => (
          <ApprovalCard
            key={project.id}
            project={project}
            gateType={gateType}
            onApprove={handleApprove}
            onReject={handleReject}
            isApproving={processingIds.has(project.id)}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  )
}
