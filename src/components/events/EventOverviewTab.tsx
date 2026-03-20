'use client'

import { useState, useEffect } from 'react'
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
  Sparkles,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Minus,
  BookmarkPlus,
} from 'lucide-react'
import { fadeInUp, staggerContainer, listItem } from '@/lib/animations'
import { EventActivityLog } from './EventActivityLog'
import { SaveAsTemplateDialog } from './templates/SaveAsTemplateDialog'
import type { EventProject } from '@/lib/hooks/useEventProject'
import type { AIStatusSummary, AIFeedbackAnalysis } from '@/lib/types/event-ai'

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
                    : 'border-slate-200 bg-white'
                }`}
              />
              <span
                className={`text-[10px] font-medium text-center leading-tight ${
                  isCurrent ? 'text-indigo-600' : isDone ? 'text-indigo-400' : 'text-slate-400'
                } ${isUpcoming ? 'opacity-60' : ''}`}
              >
                {step.label}
              </span>
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 transition-colors ${
                  isDone ? 'bg-indigo-300' : 'bg-slate-200'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── AI Status Summary section ───────────────────────────────────────────────

interface AIStatusSectionProps {
  eventProjectId: string
  initialCompletionPercent?: number
}

function AIStatusSection({ eventProjectId, initialCompletionPercent = 0 }: AIStatusSectionProps) {
  const [summary, setSummary] = useState<(AIStatusSummary & { aiGenerated: boolean }) | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchSummary() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/events/ai/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventProjectId }),
      })
      const json = (await res.json()) as { ok: boolean; data?: AIStatusSummary & { aiGenerated: boolean }; error?: { message: string } }
      if (json.ok && json.data) {
        setSummary(json.data)
      } else if (res.status === 503) {
        setError('AI summary requires GEMINI_API_KEY to be configured')
      } else {
        setError(json.error?.message ?? 'Failed to generate summary')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  // Auto-fetch on mount (two-phase pattern: first load comes quickly)
  useEffect(() => {
    void fetchSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventProjectId])

  const completionPercent = summary?.completionPercent ?? initialCompletionPercent

  return (
    <motion.div variants={listItem} className="ui-glass p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          AI Status Summary
        </h3>
        <button
          onClick={() => { void fetchSummary() }}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Refresh
        </button>
      </div>

      {/* Completion progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-500">Overall completion</span>
          <span className="text-xs font-semibold text-slate-800">{completionPercent}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${completionPercent}%`,
              background: 'linear-gradient(90deg, #3B82F6 0%, #6366F1 100%)',
            }}
          />
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && !summary && (
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-slate-100 rounded-lg w-3/4" />
          <div className="h-4 bg-slate-100 rounded-lg w-full" />
          <div className="h-4 bg-slate-100 rounded-lg w-5/6" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <p className="text-xs text-slate-400 italic">{error}</p>
      )}

      {/* AI summary content */}
      {summary && summary.aiGenerated && (
        <>
          {/* Natural language summary */}
          {summary.summary && (
            <div className="bg-gradient-to-br from-indigo-50/80 to-purple-50/80 rounded-xl p-4 border border-indigo-100/50">
              <p className="text-sm text-slate-700 leading-relaxed">{summary.summary}</p>
            </div>
          )}

          {/* At Risk items */}
          {summary.atRisk.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                At Risk
              </p>
              <div className="space-y-1">
                {summary.atRisk.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-amber-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Next steps */}
          {summary.nextSteps.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700">Next Steps</p>
              <ol className="space-y-1">
                {summary.nextSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                    <ChevronRight className="w-3.5 h-3.5 text-indigo-400 mt-0.5 flex-shrink-0" />
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </motion.div>
  )
}

// ─── Feedback Analysis section ────────────────────────────────────────────────

interface FeedbackAnalysisSectionProps {
  eventProjectId: string
}

function FeedbackAnalysisSection({ eventProjectId }: FeedbackAnalysisSectionProps) {
  const [analysis, setAnalysis] = useState<(AIFeedbackAnalysis & { responseCount: number }) | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetched, setFetched] = useState(false)

  async function fetchAnalysis() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/events/ai/analyze-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventProjectId }),
      })
      const json = (await res.json()) as { ok: boolean; data?: AIFeedbackAnalysis & { responseCount: number }; error?: { message: string } }
      setFetched(true)
      if (json.ok && json.data) {
        setAnalysis(json.data)
      } else {
        setError(json.error?.message ?? 'Failed to analyze feedback')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  const sentimentConfig: Record<string, { icon: React.ReactNode; badge: string }> = {
    positive: { icon: <ThumbsUp className="w-3 h-3" />, badge: 'bg-green-100 text-green-700' },
    negative: { icon: <ThumbsDown className="w-3 h-3" />, badge: 'bg-red-100 text-red-700' },
    neutral: { icon: <Minus className="w-3 h-3" />, badge: 'bg-slate-100 text-slate-600' },
    mixed: { icon: <Minus className="w-3 h-3" />, badge: 'bg-yellow-100 text-yellow-700' },
  }

  return (
    <motion.div variants={listItem} className="ui-glass p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          Post-Event Feedback Analysis
        </h3>
        <button
          onClick={() => { void fetchAnalysis() }}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : fetched ? (
            <RefreshCw className="w-3.5 h-3.5" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          {loading ? 'Analyzing...' : fetched ? 'Refresh Analysis' : 'Run Analysis'}
        </button>
      </div>

      {!fetched && !loading && (
        <p className="text-sm text-slate-400 text-center py-6">
          Click &quot;Run Analysis&quot; to analyze survey feedback with AI
        </p>
      )}

      {loading && (
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-slate-100 rounded-lg w-3/4" />
          <div className="h-4 bg-slate-100 rounded-lg w-full" />
          <div className="grid grid-cols-2 gap-2">
            <div className="h-16 bg-slate-100 rounded-xl" />
            <div className="h-16 bg-slate-100 rounded-xl" />
          </div>
        </div>
      )}

      {error && !loading && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {analysis && !loading && (
        <>
          <p className="text-xs text-slate-500">
            Based on{' '}
            <span className="font-semibold text-slate-700">{analysis.responseCount}</span>{' '}
            survey response{analysis.responseCount === 1 ? '' : 's'}
          </p>

          {/* Summary paragraph */}
          {analysis.summary && (
            <div className="bg-gradient-to-br from-indigo-50/80 to-purple-50/80 rounded-xl p-4 border border-indigo-100/50">
              <p className="text-sm text-slate-700 leading-relaxed">{analysis.summary}</p>
            </div>
          )}

          {/* Theme cards */}
          {analysis.themes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-2">Key Themes</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {analysis.themes.map((theme, i) => {
                  const config = sentimentConfig[theme.sentiment] ?? sentimentConfig.neutral
                  return (
                    <div key={i} className="bg-white border border-slate-100 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-slate-800 truncate pr-2">
                          {theme.theme}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${config.badge}`}
                        >
                          {config.icon}
                          {theme.sentiment}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{theme.count} mentions</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Action items */}
          {analysis.actionItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700">Action Items for Next Time</p>
              <div className="space-y-1.5">
                {analysis.actionItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs text-slate-700">
                    <div className="w-5 h-5 rounded flex items-center justify-center bg-indigo-50 border border-indigo-100 flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-indigo-500">{i + 1}</span>
                    </div>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

interface EventOverviewTabProps {
  project: EventProject
}

export function EventOverviewTab({ project }: EventOverviewTabProps) {
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)

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
  const canSaveAsTemplate = ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(project.status)

  return (
    <>
    <motion.div
      variants={staggerContainer(0.05)}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Save as Template button */}
      {canSaveAsTemplate && (
        <motion.div variants={listItem} className="flex justify-end">
          <button
            onClick={() => setIsTemplateDialogOpen(true)}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 active:scale-[0.97] transition-all cursor-pointer"
          >
            <BookmarkPlus className="w-4 h-4" />
            Save as Template
          </button>
        </motion.div>
      )}

      {/* Event Details — moved above stats for context-first reading */}
      <motion.div variants={listItem} className="ui-glass p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-400" />
          Event Details
        </h3>

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
          {(project.locationText || project.building) && (
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                {project.locationText && (
                  <p className="text-sm text-slate-900">{project.locationText}</p>
                )}
                {project.building && (
                  <p className="text-xs text-slate-500">
                    {project.building.name}
                    {project.area && ` · ${project.area.name}`}
                    {project.room && ` · ${project.room.displayName || project.room.roomNumber || 'Room'}`}
                  </p>
                )}
              </div>
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
