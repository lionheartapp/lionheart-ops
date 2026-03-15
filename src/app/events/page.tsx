'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { Plus, CalendarRange, RefreshCw, Layers } from 'lucide-react'
import { staggerContainer, cardEntrance, fadeInUp } from '@/lib/animations'
import { useEventProjects, type EventProject } from '@/lib/hooks/useEventProject'
import { CreateEventProjectModal } from '@/components/events/CreateEventProjectModal'
import { EventSeriesDrawer } from '@/components/events/EventSeriesDrawer'

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  DRAFT: { label: 'Draft', bg: 'bg-gray-100', text: 'text-gray-600' },
  PENDING_APPROVAL: { label: 'Pending Approval', bg: 'bg-amber-50', text: 'text-amber-700' },
  CONFIRMED: { label: 'Confirmed', bg: 'bg-blue-50', text: 'text-blue-700' },
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-green-50', text: 'text-green-700' },
  COMPLETED: { label: 'Completed', bg: 'bg-purple-50', text: 'text-purple-700' },
  CANCELLED: { label: 'Cancelled', bg: 'bg-red-50', text: 'text-red-600' },
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

// ─── Project Card ─────────────────────────────────────────────────────────────

function ProjectCard({ project, onClick }: { project: EventProject; onClick: () => void }) {
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
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function EventsListSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="rounded-2xl bg-gray-100 h-32" />
      ))}
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EventsEmptyState({ onCreateEvent }: { onCreateEvent: () => void }) {
  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="text-center py-16">
      <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
        <Layers className="w-7 h-7 text-indigo-500" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-2">No events yet</h3>
      <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
        Create your first event project to start planning, scheduling, and coordinating everything in one place.
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EventsPage() {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState('')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [seriesDrawerOpen, setSeriesDrawerOpen] = useState(false)

  const { data: projects, isLoading } = useEventProjects(
    statusFilter ? { status: statusFilter } : undefined
  )

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Events</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Manage all your school events from planning to completion
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSeriesDrawerOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 active:scale-[0.97] transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              New Series
            </button>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New Event
            </button>
          </div>
        </div>

        {/* Status filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
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
      </div>

      {/* Content */}
      {isLoading ? (
        <EventsListSkeleton />
      ) : !projects || projects.length === 0 ? (
        <EventsEmptyState onCreateEvent={() => setCreateModalOpen(true)} />
      ) : (
        <motion.div
          variants={staggerContainer(0.05)}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {projects.map((project) => (
            <ProjectCard
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
    </div>
  )
}
