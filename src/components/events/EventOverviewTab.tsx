'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, differenceInDays } from 'date-fns'
import {
  MapPin,
  Users,
  CalendarDays,
  CheckSquare,
  Clock,
  FileText,
  Layers,
  Check,
  Loader2,
  Pencil,
  X,
  Save,
} from 'lucide-react'
import { fadeInUp, staggerContainer, listItem } from '@/lib/animations'
import { EventActivityLog } from './EventActivityLog'
import { SaveAsTemplateDialog } from './templates/SaveAsTemplateDialog'
import { useUpdateEventProject } from '@/lib/hooks/useEventProject'
import { useToast } from '@/components/Toast'
import { AIStatusSection } from './overview/AIStatusSection'
import { FeedbackAnalysisSection } from './overview/FeedbackAnalysisSection'
import { ApprovalGatesBar, type ApprovalGates } from './overview/ApprovalGatesBar'
import ApprovalTimeline from './overview/ApprovalTimeline'
import { ConflictBanner } from './overview/ConflictBanner'
import { ResourceRequirementsSection } from './overview/ResourceRequirementsSection'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import type { EventProject } from '@/lib/hooks/useEventProject'
import { EventInvitationsSection } from './EventInvitationsSection'
import { useAuth } from '@/lib/hooks/useAuth'
import type { ConflictItem } from './overview/ConflictBanner'
import {
  SURFACE,
  BORDER,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  WARM_CHIP,
  CARD_SHADOW,
  STATUS_ACCENT,
} from '@/lib/design/warm-tokens'

/** Typed metadata fields that event projects may contain. */
interface EventProjectMetadata extends Record<string, unknown> {
  conflictReport?: {
    conflicts: ConflictItem[]
  }
  conflictCheckedAt?: string
}

// ─── Stat card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode
  value: string | number
  label: string
}

function StatCard({ icon, value, label }: StatCardProps) {
  return (
    <div
      className="px-5 py-5 rounded-2xl flex items-center justify-between gap-3"
      style={{
        backgroundColor: SURFACE,
        border: `1px solid ${BORDER}`,
        boxShadow: CARD_SHADOW,
      }}
    >
      <div className="min-w-0">
        <p
          className="text-3xl font-semibold leading-none"
          style={{ color: TEXT_PRIMARY, letterSpacing: '-0.03em' }}
        >
          {value}
        </p>
        <p
          className="mt-2 text-[10.5px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: TEXT_MUTED }}
        >
          {label}
        </p>
      </div>
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: WARM_CHIP, color: TEXT_PRIMARY }}
      >
        {icon}
      </div>
    </div>
  )
}

// ─── Status timeline ─────────────────────────────────────────────────────────

const STATUS_STEPS = [
  { key: 'DRAFT', label: 'Draft' },
  { key: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'COMPLETED', label: 'Completed' },
]

function StatusTimeline({ currentStatus }: { currentStatus: string }) {
  const currentIndex = STATUS_STEPS.findIndex((s) => s.key === currentStatus)
  const currentAccent = STATUS_ACCENT[currentStatus] ?? TEXT_PRIMARY

  return (
    <div className="w-full">
      {/* Dots and connecting lines */}
      <div className="flex items-center">
        {STATUS_STEPS.map((step, i) => {
          const isDone = i < currentIndex
          const isCurrent = i === currentIndex

          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              {/* Circle — larger, with checkmark for completed steps */}
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                style={{
                  backgroundColor: isCurrent
                    ? currentAccent
                    : isDone
                    ? TEXT_MUTED
                    : '#ffffff',
                  border: isCurrent || isDone ? 'none' : `2px solid ${BORDER}`,
                  boxShadow: isCurrent ? `0 0 0 4px ${currentAccent}1f` : 'none',
                }}
              >
                {isDone && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                {isCurrent && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
              {i < STATUS_STEPS.length - 1 && (
                <div
                  className="flex-1 h-0.5 mx-2 transition-colors"
                  style={{
                    backgroundColor: isDone ? TEXT_MUTED : BORDER,
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
      {/* Labels row — evenly spaced */}
      <div className="flex justify-between mt-2">
        {STATUS_STEPS.map((step, i) => {
          const isDone = i < currentIndex
          const isCurrent = i === currentIndex

          return (
            <span
              key={step.key}
              className="text-[10px] text-center leading-tight"
              style={{
                color: isCurrent
                  ? currentAccent
                  : isDone
                  ? TEXT_SECONDARY
                  : TEXT_MUTED,
                fontWeight: isCurrent ? 700 : 500,
                letterSpacing: '-0.005em',
              }}
            >
              {step.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

interface EventOverviewTabProps {
  project: EventProject
}

export function EventOverviewTab({ project }: EventOverviewTabProps) {
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const { toast } = useToast()
  const { user } = useAuth()
  const updateProject = useUpdateEventProject(project.id)

  // ── Editable fields state ──
  const [editTitle, setEditTitle] = useState(project.title)
  const [editDescription, setEditDescription] = useState(project.description || '')
  const [editStartsAt, setEditStartsAt] = useState(format(new Date(project.startsAt), 'yyyy-MM-dd'))
  const [editStartTime, setEditStartTime] = useState(format(new Date(project.startsAt), 'HH:mm'))
  const [editEndsAt, setEditEndsAt] = useState(format(new Date(project.endsAt), 'yyyy-MM-dd'))
  const [editEndTime, setEditEndTime] = useState(format(new Date(project.endsAt), 'HH:mm'))
  const [editAttendance, setEditAttendance] = useState(project.expectedAttendance?.toString() || '')
  const [editLocation, setEditLocation] = useState(project.locationText || '')

  function startEditing() {
    setEditTitle(project.title)
    setEditDescription(project.description || '')
    setEditStartsAt(format(new Date(project.startsAt), 'yyyy-MM-dd'))
    setEditStartTime(format(new Date(project.startsAt), 'HH:mm'))
    setEditEndsAt(format(new Date(project.endsAt), 'yyyy-MM-dd'))
    setEditEndTime(format(new Date(project.endsAt), 'HH:mm'))
    setEditAttendance(project.expectedAttendance?.toString() || '')
    setEditLocation(project.locationText || '')
    setIsEditing(true)
  }

  function cancelEditing() {
    setIsEditing(false)
  }

  async function saveEdits() {
    if (!editTitle.trim()) {
      toast('Title is required', 'error')
      return
    }

    const startDateTime = `${editStartsAt}T${editStartTime || '00:00'}:00`
    const endDateTime = project.isMultiDay
      ? `${editEndsAt}T23:59:59`
      : `${editStartsAt}T${editEndTime || '23:59'}:59`

    try {
      await updateProject.mutateAsync({
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        startsAt: new Date(startDateTime),
        endsAt: new Date(endDateTime),
        expectedAttendance: editAttendance ? parseInt(editAttendance, 10) : null,
        locationText: editLocation.trim() || null,
      })
      toast('Event updated', 'success')
      setIsEditing(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update', 'error')
    }
  }

  const startsAt = new Date(project.startsAt)
  const endsAt = new Date(project.endsAt)
  const now = new Date()
  const daysUntil = differenceInDays(startsAt, now)
  const daysText =
    daysUntil < 0
      ? `${Math.abs(daysUntil)} days ago`
      : daysUntil === 0
      ? 'Today'
      : `${daysUntil} day${daysUntil === 1 ? '' : 's'} away`

  const totalTasks = project.tasks?.length ?? project._count?.tasks ?? 0
  const completedTasks = project.tasks?.filter((t) => t.status === 'DONE').length ?? 0
  const scheduleBlocks = project.scheduleBlocks?.length ?? project._count?.scheduleBlocks ?? 0
  const initialCompletionPercent =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  const isCompleted = project.status === 'COMPLETED'

  return (
    <>
    <motion.div
      variants={staggerContainer(0.05)}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Past-date warning — event already happened but status hasn't advanced */}
      {daysUntil < 0 && (project.status === 'PENDING_APPROVAL' || project.status === 'DRAFT') && (
        <motion.div
          variants={fadeInUp}
          className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50"
        >
          <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            This event&apos;s date has passed ({Math.abs(daysUntil)} days ago). Consider updating the status or archiving it.
          </p>
        </motion.div>
      )}

      {/* Approval Gates — shown when event has gates */}
      {project.approvalGates && (
        <>
          <ApprovalGatesBar gates={project.approvalGates as unknown as ApprovalGates} />
          <ApprovalTimeline gates={project.approvalGates as unknown as ApprovalGates} />
        </>
      )}

      {/* Conflict warnings — shown when conflicts detected */}
      {(() => {
        const meta = project.metadata as EventProjectMetadata | null
        return meta?.conflictReport?.conflicts?.length ? (
          <ConflictBanner
            conflicts={meta.conflictReport.conflicts}
            checkedAt={meta.conflictCheckedAt}
          />
        ) : null
      })()}

      {/* Event Details — inline editable */}
      <motion.div variants={listItem} className="ui-glass p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: TEXT_PRIMARY }}>
            <FileText className="w-4 h-4 text-slate-400" />
            Event Details
          </h3>
          {!isEditing ? (
            <button
              type="button"
              onClick={startEditing}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={saveEdits}
                disabled={updateProject.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer disabled:opacity-60"
              >
                {updateProject.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save
              </button>
              <button
                type="button"
                onClick={cancelEditing}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
                Cancel
              </button>
            </div>
          )}
        </div>

        {isEditing ? (
          /* ── Edit Mode ── */
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Title</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                placeholder="Brief overview of this event..."
              />
            </div>

            {/* Dates */}
            {project.isMultiDay ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Start Date</label>
                  <Input
                    type="date"
                    value={editStartsAt}
                    onChange={(e) => setEditStartsAt(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">End Date</label>
                  <Input
                    type="date"
                    value={editEndsAt}
                    onChange={(e) => setEditEndsAt(e.target.value)}
                    min={editStartsAt}
                  />
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
                  <Input
                    type="date"
                    value={editStartsAt}
                    onChange={(e) => { setEditStartsAt(e.target.value); setEditEndsAt(e.target.value) }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Start Time</label>
                    <Input
                      type="time"
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">End Time</label>
                    <Input
                      type="time"
                      value={editEndTime}
                      onChange={(e) => setEditEndTime(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Location */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Location</label>
              <Input
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                placeholder="e.g. Conference Room A, Main Auditorium"
              />
            </div>

            {/* Expected Attendance */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Expected Attendance</label>
              <Input
                type="number"
                min={1}
                value={editAttendance}
                onChange={(e) => setEditAttendance(e.target.value)}
                placeholder="e.g. 120"
              />
            </div>
          </div>
        ) : (
          /* ── Read Mode ── */
          <>
            {project.description && (
              <p className="text-sm text-slate-700 leading-relaxed">{project.description}</p>
            )}

            <div className="space-y-2.5">
              {/* Dates */}
              <div className="flex items-start gap-3">
                <CalendarDays className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm" style={{ color: TEXT_PRIMARY }}>
                    {format(startsAt, 'EEEE, MMMM d, yyyy')}
                    {project.isMultiDay && ` – ${format(endsAt, 'EEEE, MMMM d, yyyy')}`}
                  </p>
                  {!project.isMultiDay && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {format(startsAt, 'h:mm a')} – {format(endsAt, 'h:mm a')}
                    </p>
                  )}
                </div>
              </div>

              {/* Location */}
              {(project.locationText || project.building || project.venueName || project.venueAddress) && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    {project.isOffCampus ? (
                      <>
                        {project.venueName && (
                          <p className="text-sm font-medium" style={{ color: TEXT_PRIMARY }}>{project.venueName}</p>
                        )}
                        {project.venueAddress && (
                          <p className="text-xs text-slate-500">{project.venueAddress}</p>
                        )}
                        <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          Off Campus
                        </span>
                      </>
                    ) : (
                      <>
                        {project.locationText && (
                          <p className="text-sm" style={{ color: TEXT_PRIMARY }}>{project.locationText}</p>
                        )}
                        {project.building && (
                          <p className={project.locationText ? 'text-xs text-slate-500' : 'text-sm'} style={project.locationText ? undefined : { color: TEXT_PRIMARY }}>
                            {project.building.name}
                            {project.area && ` · ${project.area.name}`}
                            {project.room && ` · ${project.room.displayName || project.room.roomNumber || 'Room'}`}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Expected Attendance */}
              {project.expectedAttendance && (
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <p className="text-sm text-slate-700">{project.expectedAttendance} expected attendees</p>
                </div>
              )}

              {/* Created by */}
              {project.createdBy && (
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <p className="text-sm text-slate-700">
                    Created by{' '}
                    <span className="font-medium" style={{ color: TEXT_PRIMARY }}>
                      {project.createdBy.firstName
                        ? `${project.createdBy.firstName} ${project.createdBy.lastName || ''}`.trim()
                        : project.createdBy.email}
                    </span>
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </motion.div>

      {/* Resource Requirements — A/V and Facilities needs */}
      <ResourceRequirementsSection project={project} />

      {/* Invitations & RSVP */}
      {user?.id && (
        <EventInvitationsSection
          eventProjectId={project.id}
          currentUserId={user.id}
        />
      )}

      {/* Quick Stats */}
      <motion.div variants={listItem}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={<CheckSquare className="w-5 h-5" />}
            value={`${completedTasks}/${totalTasks}`}
            label="Tasks Done"
          />
          <StatCard
            icon={<Layers className="w-5 h-5" />}
            value={scheduleBlocks}
            label="Schedule Blocks"
          />
          <StatCard
            icon={<Users className="w-5 h-5" />}
            value={project.expectedAttendance ?? '—'}
            label="Expected Attendance"
          />
          <StatCard
            icon={<Clock className="w-5 h-5" />}
            value={daysText}
            label="Event Date"
          />
        </div>
      </motion.div>

      {/* AI Summary + Event Status — side by side on desktop, stacked on mobile */}
      <motion.div variants={listItem}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* AI Status Summary */}
          <AIStatusSection
            eventProjectId={project.id}
            initialCompletionPercent={initialCompletionPercent}
          />

          {/* Status Timeline */}
          <motion.div variants={listItem} className="ui-glass p-6 flex flex-col">
            <h3 className="text-sm font-semibold mb-4" style={{ color: TEXT_PRIMARY }}>Event Status</h3>
            <div className="flex-1 flex items-center">
              <div className="w-full">
                <StatusTimeline currentStatus={project.status} />
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Post-Event Feedback Analysis — only for completed events */}
      <AnimatePresence>
        {isCompleted && (
          <motion.div
            key="feedback-analysis"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
          >
            <FeedbackAnalysisSection eventProjectId={project.id} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent Activity */}
      <motion.div variants={listItem} className="ui-glass p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold" style={{ color: TEXT_PRIMARY }}>Recent Activity</h3>
          <span className="text-xs text-slate-400">Last 5 entries</span>
        </div>
        <EventActivityLog eventProjectId={project.id} limit={5} />
      </motion.div>
    </motion.div>

    <SaveAsTemplateDialog
      eventProjectId={project.id}
      eventTitle={project.title}
      eventType={null}
      isOpen={isTemplateDialogOpen}
      onClose={() => setIsTemplateDialogOpen(false)}
    />
    </>
  )
}
