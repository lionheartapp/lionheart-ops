'use client'

import { useMemo, useState } from 'react'
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
  Wifi,
  Wrench,
  StickyNote,
} from 'lucide-react'
import { usePendingGateApprovals, useApproveGate, useRejectGate, type EventProject } from '@/lib/hooks/useEventProject'
import { staggerContainer, cardEntrance, fadeInUp } from '@/lib/animations'
import { useToast } from '@/components/Toast'
import { readResourceItems } from '@/lib/utils/resourceItems'
import { Textarea } from '@/components/ui/Textarea'
import { useActiveSchool } from '@/lib/hooks/useActiveSchool'

// ─── V2 Detection ───────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isV2GateKey(key: string): boolean {
  return UUID_RE.test(key)
}

// ─── Gate Labels ─────────────────────────────────────────────────────────────

const GATE_LABELS: Record<string, string> = {
  av: 'AV Production',
  it: 'IT Support',
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
  gateType: string
}) {
  const meta = (project.metadata ?? {}) as Record<string, unknown>

  // For V2 team UUIDs, we don't have a channel mapping — show all relevant requirements
  const isV2 = isV2GateKey(gateType)

  // Determine which requirements to show based on the gate type
  const isAV = gateType === 'av' || isV2
  const isIT = gateType === 'it' || isV2
  const isFacilities = gateType === 'facilities' || isV2
  const isAdmin = gateType === 'admin'

  const avItems = readResourceItems(meta, 'avNeeds')
  const avNeeds = avItems.map((i) => i.name)
  const avNotes = (meta.avNotes ?? '') as string
  const itItems = readResourceItems(meta, 'itNeeds')
  const itNeeds = itItems.map((i) => i.name)
  const itNotes = (meta.itNotes ?? '') as string
  const facilityItems = readResourceItems(meta, 'facilityNeeds')
  const facilityNeeds = facilityItems.map((i) => i.name)
  const facilityNotes = (meta.facilityNotes ?? '') as string

  const hasAV = project.requiresAV && (avNeeds.length > 0 || avNotes)
  const hasIT = (!!meta.requiresIT || itNeeds.length > 0) && (itNeeds.length > 0 || itNotes)
  const hasFacilities = project.requiresFacilities && (facilityNeeds.length > 0 || facilityNotes)

  // For AV gate, show AV requirements; for facilities gate, show facilities; admin sees both
  const showAV = hasAV && (isAV || isAdmin)
  const showIT = hasIT && (isIT || isAdmin)
  const showFacilities = hasFacilities && (isFacilities || isAdmin)

  if (!showAV && !showIT && !showFacilities) {
    // If the gate exists but no specific needs were listed, show a simple indicator
    if ((isAV && project.requiresAV) || (isIT && meta.requiresIT) || (isFacilities && project.requiresFacilities)) {
      return (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl mb-3">
          {isAV ? <Monitor className="w-3.5 h-3.5 text-blue-500" /> : isIT ? <Wifi className="w-3.5 h-3.5 text-cyan-500" /> : <Wrench className="w-3.5 h-3.5 text-amber-500" />}
          <span className="text-xs text-slate-600">
            {isAV ? 'A/V support' : isIT ? 'IT support' : 'Facilities support'} requested — no specific details provided
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

      {showIT && (
        <div className="bg-cyan-50/70 border border-cyan-100 rounded-xl px-3.5 py-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-cyan-600" />
            <span className="text-xs font-semibold text-cyan-800">IT Requirements</span>
          </div>
          {itNeeds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {itNeeds.map((need) => (
                <span
                  key={need}
                  className="inline-flex items-center px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 text-[10px] font-medium"
                >
                  {need}
                </span>
              ))}
            </div>
          )}
          {itNotes && (
            <div className="flex items-start gap-1.5">
              <StickyNote className="w-3 h-3 text-cyan-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-cyan-700 leading-relaxed">{itNotes}</p>
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
  gateType: string
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
        .map(([key, gate]) => ({ key, ...(gate as { status: string; teamName?: string }) }))
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
          {otherGates.map(({ key, status, teamName }) => {
            const config = GATE_STATUS_CONFIG[status] ?? GATE_STATUS_CONFIG.PENDING
            return (
              <span
                key={key}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${config.bg} ${config.text}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                {isV2GateKey(key)
                  ? (teamName ?? key)
                  : (GATE_LABELS[key] ?? key)}: {config.label}
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
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection (required)..."
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

export interface TeamApprovalQueueProps {
  /** V1 channel type ('av' | 'facilities') or V2 team UUID */
  gateType: string
  teamLabel: string
  enabled?: boolean
}

export default function TeamApprovalQueue({ gateType, teamLabel, enabled = true }: TeamApprovalQueueProps) {
  const { data: projects, isLoading, isError } = usePendingGateApprovals(gateType, enabled)
  const { toast } = useToast()
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

  // Filter the queue to the active school. Off-campus events stay visible
  // (they don't belong to a single school). Events whose campus/school
  // matches the active selection pass through; everything else is hidden
  // when a school is selected.
  const { activeSchoolId } = useActiveSchool()
  const filteredProjects = useMemo(() => {
    if (!projects) return projects
    if (!activeSchoolId) return projects
    return projects.filter((p) => {
      if (p.isOffCampus) return true
      if (p.campusId === activeSchoolId) return true
      if (p.schoolId === activeSchoolId) return true
      return false
    })
  }, [projects, activeSchoolId])

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

  if (!enabled) return null

  if (isLoading) return <QueueSkeleton />

  if (isError) {
    return (
      <div className="ui-glass p-6 text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-slate-600">Failed to load approval queue. Please refresh.</p>
      </div>
    )
  }

  if (!filteredProjects || filteredProjects.length === 0) {
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
        {filteredProjects.map((project) => (
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
