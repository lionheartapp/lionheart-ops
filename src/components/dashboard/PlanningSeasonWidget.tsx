'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { usePlanningDashboard } from '@/lib/hooks/usePlanningDashboard'
import {
  CalendarRange,
  Send,
  MessageCircle,
  AlertTriangle,
  Clock,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Circle,
  XCircle,
  FileEdit,
} from 'lucide-react'
import { cardEntrance } from '@/lib/animations'
import { useActiveSchool } from '@/lib/hooks/useActiveSchool'
import CreateEventMenu, { type EventCreateMode } from '@/components/events/CreateEventMenu'
import { CreateEventProjectModal } from '@/components/events/CreateEventProjectModal'
import { EventSeriesDrawer } from '@/components/events/EventSeriesDrawer'

interface SeasonData {
  id: string
  name: string
  phase: string
  submissionOpen: string
  submissionClose: string
  startDate: string
  endDate: string
  isSubmissionsOpen: boolean
}

interface SubmissionData {
  id: string
  title: string
  submissionStatus: string
  preferredDate: string
  priority: string
  createdAt: string
  _count: { comments: number }
}

interface ConflictData {
  id: string
  conflictType: string
  severity: string
  description: string
  affectedIds: string[]
  isResolved: boolean
  _count: { comments: number }
}

interface AdminStats {
  totalSubmissions: number
  byStatus: Record<string, number>
  unresolvedConflicts: number
}

interface DashboardPlanningData {
  season: SeasonData | null
  submissions: SubmissionData[]
  conflicts: ConflictData[]
  isAdmin: boolean
  adminStats: AdminStats | null
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  DRAFT: { icon: FileEdit, color: 'text-slate-400', label: 'Draft' },
  SUBMITTED: { icon: Send, color: 'text-blue-500', label: 'Submitted' },
  UNDER_REVIEW: { icon: Clock, color: 'text-amber-500', label: 'Under Review' },
  APPROVED_IN_PRINCIPLE: { icon: CheckCircle2, color: 'text-emerald-500', label: 'Approved in Principle' },
  NEEDS_REVISION: { icon: AlertTriangle, color: 'text-orange-500', label: 'Needs Revision' },
  DECLINED: { icon: XCircle, color: 'text-red-500', label: 'Declined' },
  APPROVED: { icon: CheckCircle2, color: 'text-emerald-600', label: 'Approved' },
  PUBLISHED: { icon: CheckCircle2, color: 'text-emerald-700', label: 'Published' },
}

function getDaysRemaining(dateStr: string): number {
  const now = new Date()
  const target = new Date(dateStr)
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function PlanningSeasonWidget() {
  const router = useRouter()
  const { activeSchoolId } = useActiveSchool()
  // F-010: shared cache so PlanningSeasonWidget + YearPlanPrompt don't both
  // fire their own /api/planning-seasons/my-dashboard request on the
  // dashboard. See src/lib/hooks/usePlanningDashboard.ts.
  const { data: dashboardData, isLoading: loading } = usePlanningDashboard(activeSchoolId ?? null)
  const data = dashboardData as DashboardPlanningData | null

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createMode, setCreateMode] = useState<'single' | 'multiday'>('single')
  const [seriesDrawerOpen, setSeriesDrawerOpen] = useState(false)

  // Don't render anything if no active season or still loading
  if (loading || !data?.season) return null

  const { season, submissions, conflicts, isAdmin, adminStats } = data
  const daysLeft = season.isSubmissionsOpen ? getDaysRemaining(season.submissionClose) : 0
  const myConflicts = conflicts.length

  return (
    <motion.div
      variants={cardEntrance}
      initial="hidden"
      animate="visible"
      className="mb-4"
    >
      {/* Banner */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {/* Header */}
        <div className="relative px-5 pt-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                <CalendarRange className="w-5 h-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 truncate">
                  {season.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {season.isSubmissionsOpen ? (
                    <>
                      <span className="inline-flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        Submissions open
                      </span>
                      {daysLeft > 0 && (
                        <span className="text-slate-400 ml-1">
                          {' '}
                          {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="capitalize">{season.phase.toLowerCase().replace('_', ' ')}</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {season.isSubmissionsOpen && (
                <CreateEventMenu
                  isAdmin={false}
                  label="Submit Event"
                  size="sm"
                  onSelect={(mode: EventCreateMode) => {
                    if (mode === 'recurring') {
                      setSeriesDrawerOpen(true)
                    } else {
                      setCreateMode(mode as 'single' | 'multiday')
                      setCreateModalOpen(true)
                    }
                  }}
                />
              )}
              {isAdmin && (
                <button
                  onClick={() => router.push('/planning')}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-full transition-[background-color,border-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-slate-300 hover:bg-slate-100 hover:shadow-sm cursor-pointer"
                >
                  Manage
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Deadline progress bar */}
          {season.isSubmissionsOpen && (
            <div className="mt-3.5">
              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span>{formatShortDate(season.submissionOpen)}</span>
                <span>{formatShortDate(season.submissionClose)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.max(5, 100 - (daysLeft / Math.max(1, getDaysRemaining(season.submissionOpen) + daysLeft)) * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Admin stats overview */}
        {isAdmin && adminStats && (
          <div className="border-t border-slate-100 px-5 py-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center py-2 rounded-lg bg-slate-50">
                <p className="text-lg font-bold text-slate-900">{adminStats.totalSubmissions}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Submissions</p>
              </div>
              <div className="text-center py-2 rounded-lg bg-slate-50">
                <p className="text-lg font-bold text-emerald-600">{adminStats.byStatus?.APPROVED ?? 0}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Approved</p>
              </div>
              <div className="text-center py-2 rounded-lg bg-slate-50">
                <p className={`text-lg font-bold ${adminStats.unresolvedConflicts > 0 ? 'text-orange-600' : 'text-slate-900'}`}>
                  {adminStats.unresolvedConflicts}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Conflicts</p>
              </div>
            </div>
          </div>
        )}

        {/* My Events */}
        {submissions.length > 0 && (
          <div className="border-t border-slate-100">
            <div className="px-5 py-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  My Events ({submissions.length})
                </h4>
                {myConflicts > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-orange-700 bg-orange-50 rounded-full border border-orange-200">
                    <AlertTriangle className="w-3 h-3" />
                    {myConflicts} conflict{myConflicts !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <AnimatePresence>
                  {submissions.slice(0, 5).map((sub) => {
                    const config = STATUS_CONFIG[sub.submissionStatus] || STATUS_CONFIG.DRAFT
                    const StatusIcon = config.icon
                    const relatedConflict = conflicts.find((c) =>
                      Array.isArray(c.affectedIds) && c.affectedIds.includes(sub.id)
                    )
                    const hasConflict = !!relatedConflict
                    const conflictChatCount = relatedConflict?._count?.comments ?? 0

                    return (
                      <motion.button
                        key={sub.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => router.push(`/planning?submission=${sub.id}`)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-transparent transition-[background-color,border-color] duration-200 hover:border-slate-200 hover:bg-slate-100 cursor-pointer text-left group"
                      >
                        <StatusIcon className={`w-4 h-4 flex-shrink-0 ${config.color}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-900 truncate group-hover:text-slate-700">
                            {sub.title}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {formatShortDate(sub.preferredDate)} — {config.label}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {hasConflict && (
                            <span className="inline-flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                              {conflictChatCount > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-orange-600">
                                  <MessageCircle className="w-3 h-3" />
                                  {conflictChatCount}
                                </span>
                              )}
                            </span>
                          )}
                          {sub._count.comments > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                              <MessageCircle className="w-3.5 h-3.5" />
                              {sub._count.comments}
                            </span>
                          )}
                          <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                        </div>
                      </motion.button>
                    )
                  })}
                </AnimatePresence>
              </div>

              {submissions.length > 5 && (
                <button
                  onClick={() => router.push('/planning')}
                  className="w-full mt-1 rounded-lg py-2 text-xs text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
                >
                  View all {submissions.length} events
                </button>
              )}
            </div>
          </div>
        )}

        {/* Empty state — no submissions yet but collecting */}
        {submissions.length === 0 && season.isSubmissionsOpen && (
          <div className="border-t border-slate-100 px-5 py-4">
            <p className="text-sm text-slate-500 text-center">
              No events submitted yet. Start planning your events for {season.name}.
            </p>
          </div>
        )}

        {/* Footer link */}
        <div className="border-t border-slate-100">
          <button
            onClick={() => router.push('/planning')}
            className="w-full flex items-center justify-center gap-1.5 px-5 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors duration-200 cursor-pointer"
          >
            View Year Plan
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Event creation drawers — routed as planning submissions */}
      <CreateEventProjectModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        initialMode={createMode}
        planningSeasonId={season.id}
      />
      <EventSeriesDrawer
        isOpen={seriesDrawerOpen}
        onClose={() => setSeriesDrawerOpen(false)}
      />
    </motion.div>
  )
}
