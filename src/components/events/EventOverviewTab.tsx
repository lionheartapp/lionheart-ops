'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { format, differenceInDays } from 'date-fns'
import {
  MapPin,
  Users,
  CalendarDays,
  CheckSquare,
  Clock,
  FileText,
  Layers,
  BookmarkPlus,
} from 'lucide-react'
import { fadeInUp, staggerContainer, listItem } from '@/lib/animations'
import { EventActivityLog } from './EventActivityLog'
import { SaveAsTemplateDialog } from './templates/SaveAsTemplateDialog'
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
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
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
    <div className="flex items-center gap-0">
      {STATUS_STEPS.map((step, i) => {
        const isDone = i < currentIndex
        const isCurrent = i === currentIndex
        const isUpcoming = i > currentIndex

        return (
          <div key={step.key} className="flex items-center flex-1 min-w-0 last:flex-none">
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div
                className={`w-3 h-3 rounded-full border-2 transition-colors ${
                  isCurrent
                    ? 'border-indigo-500 bg-indigo-500'
                    : isDone
                    ? 'border-indigo-300 bg-indigo-300'
                    : 'border-gray-200 bg-white'
                }`}
              />
              <span
                className={`text-[10px] font-medium text-center leading-tight ${
                  isCurrent ? 'text-indigo-600' : isDone ? 'text-indigo-400' : 'text-gray-400'
                } ${isUpcoming ? 'opacity-60' : ''}`}
              >
                {step.label}
              </span>
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 transition-colors ${
                  isDone ? 'bg-indigo-300' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

interface EventOverviewTabProps {
  project: EventProject
}

// Statuses where saving as a template makes sense (not DRAFT — incomplete events)
const TEMPLATE_ELIGIBLE_STATUSES = ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED']

export function EventOverviewTab({ project }: EventOverviewTabProps) {
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false)

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

  const canSaveAsTemplate = TEMPLATE_ELIGIBLE_STATUSES.includes(project.status)

  return (
    <>
    <motion.div
      variants={staggerContainer(0.05)}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Overview header with Save as Template action */}
      {canSaveAsTemplate && (
        <motion.div variants={listItem} className="flex justify-end">
          <button
            onClick={() => setSaveTemplateOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 active:scale-[0.97] transition-all cursor-pointer"
          >
            <BookmarkPlus className="w-4 h-4 text-gray-500" aria-hidden="true" />
            Save as Template
          </button>
        </motion.div>
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

      {/* Event Details */}
      <motion.div variants={listItem} className="ui-glass p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" />
          Event Details
        </h3>

        {project.description && (
          <p className="text-sm text-gray-700 leading-relaxed">{project.description}</p>
        )}

        <div className="space-y-2.5">
          {/* Dates */}
          <div className="flex items-start gap-3">
            <CalendarDays className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-gray-900">
                {format(startsAt, 'EEEE, MMMM d, yyyy')}
                {project.isMultiDay && ` – ${format(endsAt, 'EEEE, MMMM d, yyyy')}`}
              </p>
              {!project.isMultiDay && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {format(startsAt, 'h:mm a')} – {format(endsAt, 'h:mm a')}
                </p>
              )}
            </div>
          </div>

          {/* Location */}
          {(project.locationText || project.building) && (
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                {project.locationText && (
                  <p className="text-sm text-gray-900">{project.locationText}</p>
                )}
                {project.building && (
                  <p className="text-xs text-gray-500">
                    {project.building.name}
                    {project.area && ` · ${project.area.name}`}
                    {project.room && ` · ${project.room.name}`}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Created by */}
          {project.createdBy && (
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <p className="text-sm text-gray-700">
                Created by{' '}
                <span className="font-medium text-gray-900">
                  {project.createdBy.firstName
                    ? `${project.createdBy.firstName} ${project.createdBy.lastName || ''}`.trim()
                    : project.createdBy.email}
                </span>
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Status Timeline */}
      <motion.div variants={listItem} className="ui-glass p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Event Status</h3>
        <StatusTimeline currentStatus={project.status} />
      </motion.div>

      {/* Recent Activity */}
      <motion.div variants={listItem} className="ui-glass p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
          <span className="text-xs text-gray-400">Last 5 entries</span>
        </div>
        <EventActivityLog eventProjectId={project.id} limit={5} />
      </motion.div>
    </motion.div>

    {/* Save as Template dialog */}
    {canSaveAsTemplate && (
      <SaveAsTemplateDialog
        eventProjectId={project.id}
        eventTitle={project.title}
        eventType={(project.metadata?.eventType as string | null) ?? null}
        isOpen={saveTemplateOpen}
        onClose={() => setSaveTemplateOpen(false)}
      />
    )}
    </>
  )
}
