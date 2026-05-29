'use client'

/**
 * Day-Of Operations Page — /events/[id]/dayof
 *
 * Staff-only page for day-of event management.
 * Renders DayOfDashboard with QR check-in, roster, incidents, and headcount tabs.
 * Auth is enforced client-side (permission check inside DayOfDashboard's hooks);
 * the page itself is under /events/* which middleware marks public for the
 * public registration flow, so we rely on the API routes being protected.
 */

import { use } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { staggerContainer, listItem } from '@/lib/animations'

import { useEventProject } from '@/lib/hooks/useEventProject'
import PagePadding from '@/components/PagePadding'

const DayOfDashboard = dynamic(() => import('@/components/events/dayof/DayOfDashboard'), {
  loading: () => <DayOfSkeleton />,
})

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DayOfSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-6 rounded w-24 mb-6" style={{ backgroundColor: '#ede9e0' }} />
      <div className="h-8 rounded w-1/2 mb-3" style={{ backgroundColor: '#ede9e0' }} />
      <div className="h-4 rounded w-1/4 mb-8" style={{ backgroundColor: '#f6f4f0' }} />
      <div className="flex gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-10 rounded-full w-28"
            style={{ backgroundColor: '#f6f4f0' }}
          />
        ))}
      </div>
      <div className="h-96 rounded-2xl" style={{ backgroundColor: '#f6f4f0' }} />
    </div>
  )
}

// ─── Not Found ────────────────────────────────────────────────────────────────

function EventNotFound({ onBack }: { onBack: () => void }) {
  return (
    <div className="text-center py-16">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
        style={{ backgroundColor: '#f6f4f0' }}
      >
        <AlertCircle
          className="w-7 h-7"
          strokeWidth={1.75}
          style={{ color: '#1a1915' }}
        />
      </div>
      <h3
        className="text-[17px] font-semibold mb-2"
        style={{ color: '#1a1915', letterSpacing: '-0.015em' }}
      >
        Event not found
      </h3>
      <p className="text-[13.5px] mb-6" style={{ color: '#6a6864' }}>
        This event may have been deleted or you may not have access.
      </p>
      <button
        onClick={onBack}
        className="px-5 py-2.5 rounded-full text-[13px] font-semibold transition-all duration-200 cursor-pointer hover:-translate-y-px"
        style={{
          backgroundColor: '#1a1915',
          color: '#ffffff',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.04)',
        }}
      >
        Back to Events
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface DayOfPageProps {
  params: Promise<{ id: string }>
}

export default function DayOfPage({ params }: DayOfPageProps) {
  const { id } = use(params)
  const router = useRouter()

  const { data: project, isLoading, error } = useEventProject(id)

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <DayOfSkeleton />
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

  const eventDate = project.startsAt ? project.startsAt.split('T')[0] : undefined

  return (
    <PagePadding>
    <div className="min-h-screen">
      <motion.div
        variants={staggerContainer(0.05)}
        initial="hidden"
        animate="visible"
      >
        {/* Back nav */}
        <motion.div variants={listItem} className="mb-5">
          <button
            onClick={() => router.push(`/events/${id}`)}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors cursor-pointer -ml-1 px-1 py-0.5 rounded-lg hover:bg-slate-100"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Event
          </button>
        </motion.div>

        {/* Day-of dashboard */}
        <motion.div variants={listItem}>
          <DayOfDashboard
            eventProjectId={project.id}
            eventName={project.title}
            eventDate={eventDate}
          />
        </motion.div>
      </motion.div>
    </div>
    </PagePadding>
  )
}
