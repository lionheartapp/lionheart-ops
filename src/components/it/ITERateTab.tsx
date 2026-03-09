'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryOptions, queryKeys } from '@/lib/queries'
import { fetchApi } from '@/lib/api-client'
import { motion } from 'framer-motion'
import { staggerContainer, fadeInUp } from '@/lib/animations'
import AnimatedCounter from '@/components/motion/AnimatedCounter'
import { IllustrationCompliance } from '@/components/illustrations'
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  Clock,
  FileText,
  Download,
  Loader2,
  Sparkles,
  CalendarDays,
  ChevronDown,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────

interface ITERateTabProps {
  canManage: boolean
}

interface ERateTask {
  id: string
  title: string
  description: string | null
  dueDate: string
  status: 'UPCOMING' | 'DUE_SOON' | 'OVERDUE' | 'COMPLETED'
  completedAt: string | null
  completedNotes: string | null
  documentCount: number
}

interface ERateDocument {
  id: string
  title: string
  type: string
  schoolYear: string
  uploadedAt: string
  retentionUntil: string | null
  tags: string[]
}

// ─── Helpers ────────────────────────────────────────────────────────────

function getCurrentSchoolYear(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  if (month >= 7) return `${year}-${year + 1}`
  return `${year - 1}-${year}`
}

function getSchoolYearOptions(): string[] {
  const now = new Date()
  const year = now.getFullYear()
  const options: string[] = []
  for (let y = year + 1; y >= year - 3; y--) {
    options.push(`${y}-${y + 1}`)
  }
  return options
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function daysUntil(dateStr: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const due = new Date(dateStr)
  due.setHours(0, 0, 0, 0)
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

const STATUS_DOT: Record<string, string> = {
  COMPLETED: 'bg-green-500',
  OVERDUE: 'bg-red-500',
  DUE_SOON: 'bg-yellow-500',
  UPCOMING: 'bg-gray-400',
}

// ─── Skeleton ───────────────────────────────────────────────────────────

function ERateSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-9 w-36 bg-gray-200 rounded-lg animate-pulse" />
        <div className="flex gap-2">
          <div className="h-10 w-32 bg-gray-200 rounded-full animate-pulse" />
          <div className="h-10 w-40 bg-gray-200 rounded-full animate-pulse" />
        </div>
      </div>

      {/* Progress card skeleton */}
      <div className="ui-glass p-6 space-y-3">
        <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-3 w-full bg-gray-200 rounded-full animate-pulse" />
        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
      </div>

      {/* Timeline skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="ui-glass p-5 flex items-start gap-4">
            <div className="w-3 h-3 rounded-full bg-gray-200 animate-pulse mt-1.5" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-64 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-96 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="ui-glass-table">
        <div className="p-4 border-b border-gray-200/30">
          <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-4 border-b border-gray-100 flex gap-4">
            <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────────────────

export default function ITERateTab({ canManage }: ITERateTabProps) {
  const queryClient = useQueryClient()
  const [schoolYear, setSchoolYear] = useState(getCurrentSchoolYear)
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)
  const [completeNotes, setCompleteNotes] = useState('')

  // ── Queries ──

  const {
    data: calendarData,
    isLoading: calendarLoading,
  } = useQuery(queryOptions.itERateCalendar(schoolYear))

  const {
    data: documentsData,
    isLoading: documentsLoading,
  } = useQuery(queryOptions.itERateDocuments(schoolYear))

  const tasks: ERateTask[] = useMemo(() => {
    if (!calendarData) return []
    const raw = (calendarData as { tasks?: ERateTask[] })?.tasks
    return Array.isArray(raw) ? raw : Array.isArray(calendarData) ? calendarData as ERateTask[] : []
  }, [calendarData])

  const documents: ERateDocument[] = useMemo(() => {
    if (!documentsData) return []
    const raw = (documentsData as { documents?: ERateDocument[] })?.documents
    return Array.isArray(raw) ? raw : Array.isArray(documentsData) ? documentsData as ERateDocument[] : []
  }, [documentsData])

  // ── Derived stats ──

  const completedCount = tasks.filter((t) => t.status === 'COMPLETED').length
  const totalCount = tasks.length
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  // ── Mutations ──

  const seedMutation = useMutation({
    mutationFn: () =>
      fetchApi<unknown>('/api/it/erate/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolYear }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itERateCalendar.all })
    },
  })

  const completeMutation = useMutation({
    mutationFn: (taskId: string) =>
      fetchApi<unknown>(`/api/it/erate/calendar/${taskId}/complete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: completeNotes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itERateCalendar.all })
      setCompletingTaskId(null)
      setCompleteNotes('')
    },
  })

  const [generatingDoc, setGeneratingDoc] = useState(false)

  async function handleGenerateDocPackage() {
    setGeneratingDoc(true)
    try {
      const blob = await fetch('/api/it/erate/documentation-package', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({ schoolYear }),
      }).then((r) => r.blob())
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `erate-documentation-${schoolYear}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setGeneratingDoc(false)
    }
  }

  // ── Loading state ──

  if (calendarLoading && documentsLoading) {
    return <ERateSkeleton />
  }

  // ── Render ──

  return (
    <motion.div
      variants={staggerContainer()}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* ── Header Row ── */}
      <motion.div variants={fadeInUp} className="flex items-center justify-between flex-wrap gap-3">
        <div className="relative">
          <select
            value={schoolYear}
            onChange={(e) => setSchoolYear(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white appearance-none pr-8 cursor-pointer"
          >
            {getSchoolYearOptions().map((sy) => (
              <option key={sy} value={sy}>
                {sy}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>

        <div className="flex gap-2">
          {canManage && (
            <button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="px-5 py-2.5 rounded-full bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 active:scale-[0.97] transition-colors duration-200 disabled:opacity-50"
            >
              {seedMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Seeding...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Seed Calendar
                </span>
              )}
            </button>
          )}

          {canManage && (
            <button
              onClick={handleGenerateDocPackage}
              disabled={generatingDoc}
              className="px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-colors duration-200 disabled:opacity-50"
            >
              {generatingDoc ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Generate Doc Package
                </span>
              )}
            </button>
          )}
        </div>
      </motion.div>

      {/* ── Progress Card ── */}
      <motion.div
        variants={fadeInUp}
        className="bg-gradient-to-br from-primary-50/80 to-primary-100/80 backdrop-blur-sm border border-primary-200/30 rounded-2xl shadow-sm p-6"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">E-Rate Compliance Progress</h3>
          <span className="text-sm text-gray-600">
            <AnimatedCounter value={completedCount} className="font-semibold text-gray-900" />
            /{totalCount} Tasks Complete
          </span>
        </div>
        <div className="w-full h-3 bg-white/60 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">{progressPct}% complete for {schoolYear}</p>
      </motion.div>

      {/* ── E-Rate Calendar Timeline ── */}
      <motion.div variants={fadeInUp} className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-gray-500" />
          E-Rate Calendar
        </h3>

        {tasks.length === 0 && !calendarLoading && (
          <div className="ui-glass p-8 text-center">
            <IllustrationCompliance className="w-40 h-32 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-600 mb-1">No calendar tasks for {schoolYear}.</p>
            {canManage && (
              <p className="text-xs text-gray-400 mt-1">
                Use &quot;Seed Calendar&quot; to populate the E-Rate timeline.
              </p>
            )}
          </div>
        )}

        {tasks.map((task) => {
          const days = daysUntil(task.dueDate)
          const isCompleting = completingTaskId === task.id

          return (
            <motion.div
              key={task.id}
              variants={fadeInUp}
              className="ui-glass p-5"
            >
              <div className="flex items-start gap-4">
                {/* Status dot */}
                <div className="pt-1">
                  {task.status === 'COMPLETED' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <span
                      className={`block w-3 h-3 rounded-full ${STATUS_DOT[task.status] || 'bg-gray-400'}`}
                    />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">{task.title}</h4>
                      {task.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>
                      )}
                    </div>

                    {/* Document count badge */}
                    {task.documentCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium shrink-0">
                        <FileText className="w-3 h-3" />
                        {task.documentCount}
                      </span>
                    )}
                  </div>

                  {/* Date + days info */}
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <span className="text-gray-500">
                      <Clock className="w-3 h-3 inline mr-1" />
                      Due {formatDate(task.dueDate)}
                    </span>
                    {task.status === 'COMPLETED' ? (
                      <span className="text-green-600 font-medium">
                        Completed {task.completedAt ? formatDate(task.completedAt) : ''}
                      </span>
                    ) : task.status === 'OVERDUE' ? (
                      <span className="text-red-600 font-medium">
                        {Math.abs(days)} day{Math.abs(days) !== 1 ? 's' : ''} overdue
                      </span>
                    ) : days <= 0 ? (
                      <span className="text-yellow-600 font-medium">Due today</span>
                    ) : (
                      <span className="text-gray-500">
                        {days} day{days !== 1 ? 's' : ''} remaining
                      </span>
                    )}
                  </div>

                  {/* Mark Complete button / inline form */}
                  {canManage && task.status !== 'COMPLETED' && (
                    <div className="mt-3">
                      {isCompleting ? (
                        <div className="space-y-2">
                          <textarea
                            value={completeNotes}
                            onChange={(e) => setCompleteNotes(e.target.value)}
                            placeholder="Completion notes (optional)"
                            rows={2}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => completeMutation.mutate(task.id)}
                              disabled={completeMutation.isPending}
                              className="px-4 py-1.5 rounded-full bg-green-600 text-white text-xs font-medium hover:bg-green-700 active:scale-[0.97] transition-colors duration-200 disabled:opacity-50"
                            >
                              {completeMutation.isPending ? (
                                <span className="flex items-center gap-1">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Saving...
                                </span>
                              ) : (
                                'Confirm Complete'
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setCompletingTaskId(null)
                                setCompleteNotes('')
                              }}
                              className="px-4 py-1.5 rounded-full bg-white border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 active:scale-[0.97] transition-colors duration-200"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setCompletingTaskId(task.id)}
                          className="px-4 py-1.5 rounded-full bg-white border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50 active:scale-[0.97] transition-colors duration-200"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                          Mark Complete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )
        })}
      </motion.div>

      {/* ── Document Archive ── */}
      <motion.div variants={fadeInUp}>
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-gray-500" />
          Document Archive
        </h3>

        {documents.length === 0 && !documentsLoading ? (
          <div className="ui-glass p-8 text-center">
            <IllustrationCompliance className="w-40 h-32 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-600 mb-1">No documents for {schoolYear}.</p>
          </div>
        ) : (
          <div className="ui-glass-table">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      School Year
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Uploaded
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Retention Until
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Tags
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50/50 transition-colors duration-200">
                      <td className="px-4 py-3 font-medium text-gray-900">{doc.title}</td>
                      <td className="px-4 py-3 text-gray-600">{doc.type}</td>
                      <td className="px-4 py-3 text-gray-600">{doc.schoolYear}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(doc.uploadedAt)}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {doc.retentionUntil ? formatDate(doc.retentionUntil) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {doc.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
