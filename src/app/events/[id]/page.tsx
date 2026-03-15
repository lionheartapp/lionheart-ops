'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { ArrowLeft, CalendarDays, MapPin, Loader2, AlertCircle } from 'lucide-react'
import { fadeInUp, staggerContainer, listItem } from '@/lib/animations'
import { useEventProject, useApproveEventProject } from '@/lib/hooks/useEventProject'
import { EventProjectTabs } from '@/components/events/EventProjectTabs'
import { useToast } from '@/components/Toast'

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  DRAFT: { label: 'Draft', bg: 'bg-gray-100', text: 'text-gray-600' },
  PENDING_APPROVAL: { label: 'Pending Approval', bg: 'bg-amber-50', text: 'text-amber-700' },
  CONFIRMED: { label: 'Confirmed', bg: 'bg-blue-50', text: 'text-blue-700' },
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-green-50', text: 'text-green-700' },
  COMPLETED: { label: 'Completed', bg: 'bg-purple-50', text: 'text-purple-700' },
  CANCELLED: { label: 'Cancelled', bg: 'bg-red-50', text: 'text-red-600' },
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function EventProjectSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-24 mb-6" />
      <div className="h-8 bg-gray-200 rounded w-2/3 mb-3" />
      <div className="h-4 bg-gray-100 rounded w-1/3 mb-8" />
      <div className="flex gap-2 border-b border-gray-200 mb-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 rounded w-20" />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

// ─── 404 State ────────────────────────────────────────────────────────────────

function EventNotFound({ onBack }: { onBack: () => void }) {
  return (
    <div className="text-center py-16">
      <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-7 h-7 text-red-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-2">Event project not found</h3>
      <p className="text-sm text-gray-500 mb-6">
        This event may have been deleted or you may not have access.
      </p>
      <button
        onClick={onBack}
        className="px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all cursor-pointer"
      >
        Back to Events
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface EventProjectPageProps {
  params: Promise<{ id: string }>
}

export default function EventProjectPage({ params }: EventProjectPageProps) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()

  const { data: project, isLoading, error } = useEventProject(id)
  const approveProject = useApproveEventProject(id)

  async function handleApprove() {
    try {
      await approveProject.mutateAsync()
      toast('Event project approved', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to approve event', 'error')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <EventProjectSkeleton />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="min-h-screen">
        <EventNotFound onBack={() => router.push('/events')} />
      </div>
    )
  }

  const statusConfig = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.DRAFT
  const startsAt = new Date(project.startsAt)
  const endsAt = new Date(project.endsAt)

  const dateDisplay = project.isMultiDay
    ? `${format(startsAt, 'MMM d')} – ${format(endsAt, 'MMM d, yyyy')}`
    : `${format(startsAt, 'EEEE, MMM d, yyyy')}, ${format(startsAt, 'h:mm a')} – ${format(endsAt, 'h:mm a')}`

  const creatorName = project.createdBy?.firstName
    ? `${project.createdBy.firstName} ${project.createdBy.lastName || ''}`.trim()
    : project.createdBy?.email

  return (
    <div className="min-h-screen">
      <motion.div
        variants={staggerContainer(0.05)}
        initial="hidden"
        animate="visible"
      >
        {/* Back nav */}
        <motion.div variants={listItem} className="mb-5">
          <button
            onClick={() => router.push('/events')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors cursor-pointer -ml-1 px-1 py-0.5 rounded-lg hover:bg-gray-100"
          >
            <ArrowLeft className="w-4 h-4" />
            Events
          </button>
        </motion.div>

        {/* Header */}
        <motion.div variants={listItem} className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusConfig.bg} ${statusConfig.text}`}>
                  {statusConfig.label}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{project.title}</h1>

              {/* Meta row */}
              <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-gray-400" />
                  {dateDisplay}
                </div>
                {project.locationText && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    {project.locationText}
                  </div>
                )}
                {creatorName && (
                  <span className="text-gray-400">By {creatorName}</span>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {project.status === 'PENDING_APPROVAL' && (
                <button
                  onClick={handleApprove}
                  disabled={approveProject.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60 active:scale-[0.97] transition-all cursor-pointer"
                >
                  {approveProject.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Approve
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div variants={listItem}>
          <EventProjectTabs project={project} />
        </motion.div>
      </motion.div>
    </div>
  )
}
