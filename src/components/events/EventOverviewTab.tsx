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
import { ConflictBanner } from './overview/ConflictBanner'
import { ResourceRequirementsSection } from './overview/ResourceRequirementsSection'
import type { EventProject } from '@/lib/hooks/useEventProject'

// ─── Stat card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode
  value: string | number
  label: string
}

function StatCard({ icon, value, label }: StatCardProps) {
  return (
    <div className="ui-glass p-4 text-center">
      <div className="flex justify-center mb-2 text-indigo-500">{icon}</div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
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
                className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                  isCurrent
                    ? 'bg-indigo-500 ring-4 ring-indigo-100'
                    : isDone
                    ? 'bg-slate-300'
                    : 'border-2 border-slate-200 bg-white'
                }`}
              >
                {isDone && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                {isCurrent && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
              {i < STATUS_STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 transition-colors ${
                    isDone ? 'bg-slate-300' : 'bg-slate-200'
                  }`}
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
              className={`text-[10px] font-medium text-center leading-tight ${
                isCurrent ? 'text-indigo-600 font-semibold' : isDone ? 'text-slate-500' : 'text-slate-300'
              }`}
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
  const updateProject = useUpdateEventProject(project.id)

  // ── Editable fields state ──
  const [editTitle, setEditTitle] = useState(project.title)
  const [editDescription, setEditDescription] = useState(project.description || '')
  const [editStartsAt, setEditStartsAt] = useState(format(new Date(project.startsAt), 'yyyy-MM-dd'))
  const [editStartTime, setEditStartTime] = useState(format(new Date(project.startsAt), 'HH:mm'))
  const [editEndsAt, setEditEndsAt] = useState(format(new Date(project.endsAt), 'yyyy-MM-dd'))
  const [editEndTime, setEditEndTime] = useState(format(new Date(project.endsAt), 'HH:mm'))
  const [editAttendance, setEditAttendance] = useState(project.expectedAttendance?.toString() || '')

  function startEditing() {
    setEditTitle(project.title)
    setEditDescription(project.description || '')
    setEditStartsAt(format(new Date(project.startsAt), 'yyyy-MM-dd'))
    setEditStartTime(format(new Date(project.startsAt), 'HH:mm'))
    setEditEndsAt(format(new Date(project.endsAt), 'yyyy-MM-dd'))
    setEditEndTime(format(new Date(project.endsAt), 'HH:mm'))
    setEditAttendance(project.expectedAttendance?.toString() || '')
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

  const totalTasks = project._count?.tasks ?? 0
  const completedTasks = project.tasks?.filter((t) => t.status === 'DONE').length ?? 0
  const scheduleBlocks = project._count?.scheduleBlocks ?? 0
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
      {/* Approval Gates — shown when event is pending approval */}
      {project.approvalGates && (project.status === 'PENDING_APPROVAL' || project.status === 'DRAFT') && (
        <ApprovalGatesBar gates={project.approvalGates as unknown as ApprovalGates} />
      )}

      {/* Conflict warnings — shown when conflicts detected */}
      {(project.metadata as any)?.conflictReport?.conflicts?.length > 0 && (
        <ConflictBanner
          conflicts={(project.metadata as any).conflictReport.conflicts}
          checkedAt={(project.metadata as any).conflictCheckedAt}
        />
      )}

      {/* Resource Requirements — A/V and Facilities needs */}
      <ResourceRequirementsSection project={project} />

      {/* Event Details — inline editable */}
      <motion.div variants={listItem} className="ui-glass p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" />
            Event Details
          </h3>
          {!isEditing ? (
            <button
              type="button"
              onClick={startEditing}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
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
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                placeholder="Brief overview of this event..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 resize-none"
              />
            </div>

            {/* Dates */}
            {project.isMultiDay ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={editStartsAt}
                    onChange={(e) => setEditStartsAt(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">End Date</label>
                  <input
                    type="date"
                    value={editEndsAt}
                    onChange={(e) => setEditEndsAt(e.target.value)}
                    min={editStartsAt}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
                  <input
                    type="date"
                    value={editStartsAt}
                    onChange={(e) => { setEditStartsAt(e.target.value); setEditEndsAt(e.target.value) }}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Start Time</label>
                    <input
                      type="time"
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">End Time</label>
                    <input
                      type="time"
                      value={editEndTime}
                      onChange={(e) => setEditEndTime(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Expected Attendance */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Expected Attendance</label>
              <input
                type="number"
                min="1"
                value={editAttendance}
                onChange={(e) => setEditAttendance(e.target.value)}
                placeholder="e.g. 120"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
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
                  <p className="text-sm text-slate-900">
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
                          <p className="text-sm text-slate-900 font-medium">{project.venueName}</p>
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
                          <p className="text-sm text-slate-900">{project.locationText}</p>
                        )}
                        {project.building && (
                          <p className={project.locationText ? 'text-xs text-slate-500' : 'text-sm text-slate-900'}>
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
                    <span className="font-medium text-slate-900">
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
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Event Status</h3>
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
          <h3 className="text-sm font-semibold text-slate-900">Recent Activity</h3>
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
