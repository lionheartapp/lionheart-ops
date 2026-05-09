'use client'

/**
 * TasksFocusWidget — half-width "today's focus" widget that sits above the
 * calendar, paired with WeatherWidget.
 *
 * Style: clean white card matching the existing Lionheart card spec, with a
 * thin warm-to-cool gradient strip across the top.
 *
 * Behavior:
 *   - Greets the user by first name with an encouraging headline.
 *   - Surfaces the highest-priority open task assigned to the user.
 *   - Shows a progress bar across all of today's tasks.
 *   - Tone is supportive but professional — no emoji, no exclamation marks.
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Sun, ArrowRight, CheckCircle2 } from 'lucide-react'
import {
  useMyTasks,
  usePersonalTasks,
  useUpdateMyTaskStatus,
  useUpdatePersonalTask,
  type MyTask,
  type PersonalTask,
} from '@/lib/hooks/useMyTasks'
import { cardEntrance } from '@/lib/animations'

interface TasksFocusWidgetProps {
  /** Logged-in user's first name. */
  firstName: string
  /** Callback when "View all tasks" is clicked (opens drawer). */
  onViewAll?: () => void
}

interface DisplayTask {
  id: string
  title: string
  dueDate: string | null
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'
  source: 'event' | 'personal'
  eventProjectId?: string
}

export default function TasksFocusWidget({
  firstName,
  onViewAll,
}: TasksFocusWidgetProps) {
  const { data: eventTasks = [], isLoading: loadingEvent } = useMyTasks()
  const { data: personalTasks = [], isLoading: loadingPersonal } = usePersonalTasks()

  const loading = loadingEvent || loadingPersonal

  if (loading) {
    return <TasksSkeleton />
  }

  const display = buildDisplayList(eventTasks, personalTasks)
  const totalOpen = display.openCount
  const totalDoneToday = display.doneTodayCount
  const totalToday = totalOpen + totalDoneToday
  const progress = totalToday === 0 ? 100 : Math.round((totalDoneToday / totalToday) * 100)
  const top = display.topTask

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={cardEntrance}
      className="card-hover relative bg-white border border-gray-200 rounded-xl p-6 overflow-hidden"
    >
      {/* Top accent strip — warm to cool */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-400 via-blue-500 to-indigo-500"
        aria-hidden
      />

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center">
            <Sun className="w-3.5 h-3.5 text-amber-600" aria-hidden />
          </div>
          <p className="text-xs font-bold tracking-wide uppercase text-slate-500">Today&apos;s focus</p>
        </div>
        <span className="text-[11px] font-bold text-slate-400">
          {totalToday === 0 ? 'No tasks yet' : `${totalDoneToday} of ${totalToday} done`}
        </span>
      </div>

      {/* Encouraging headline */}
      <h3 className="text-[17px] font-semibold leading-snug text-slate-900 mt-3">
        {buildHeadline({ firstName, totalOpen, totalDoneToday })}
      </h3>

      {/* Top task or empty state */}
      <div className="mt-4">
        {top ? (
          <TopTaskRow task={top} />
        ) : (
          <EmptyTasksState />
        )}
      </div>

      {/* Progress + footer */}
      <div className="mt-4 flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <span className="text-[11px] font-bold text-slate-600 tabular-nums">{progress}%</span>
      </div>

      {/* View all */}
      <button
        type="button"
        onClick={onViewAll}
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors duration-200 cursor-pointer"
      >
        View all tasks
        <ArrowRight className="w-3 h-3" aria-hidden />
      </button>
    </motion.div>
  )
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function TopTaskRow({ task }: { task: DisplayTask }) {
  const updateMyTask = useUpdateMyTaskStatus()
  const updatePersonal = useUpdatePersonalTask()

  const dueLabel = task.dueDate ? formatDueDate(task.dueDate) : null
  const priorityLabel = task.priority === 'CRITICAL' || task.priority === 'HIGH' ? task.priority : null

  const href =
    task.source === 'event' && task.eventProjectId
      ? `/events/${task.eventProjectId}/tasks/${task.id}`
      : '/tasks'

  function handleComplete(): void {
    if (task.source === 'event' && task.eventProjectId) {
      updateMyTask.mutate({
        eventProjectId: task.eventProjectId,
        taskId: task.id,
        status: 'DONE',
      })
    } else {
      updatePersonal.mutate({ taskId: task.id, status: 'DONE' })
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button
          type="button"
          onClick={handleComplete}
          aria-label={`Mark "${task.title}" complete`}
          className="w-5 h-5 rounded-full border-2 border-slate-300 hover:border-blue-500 hover:bg-blue-50 transition-colors duration-200 flex-shrink-0 cursor-pointer"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 truncate">{task.title}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {dueLabel ? dueLabel : 'No due date'}
            {priorityLabel && (
              <>
                <span className="mx-1">·</span>
                <span className={priorityLabel === 'CRITICAL' ? 'text-red-600 font-semibold' : 'text-amber-700 font-semibold'}>
                  {priorityLabel === 'CRITICAL' ? 'Critical' : 'High priority'}
                </span>
              </>
            )}
          </p>
        </div>
      </div>
      <Link
        href={href}
        className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors duration-200 flex-shrink-0 cursor-pointer"
      >
        Open
      </Link>
    </div>
  )
}

function EmptyTasksState() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-100">
      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" aria-hidden />
      <div>
        <p className="text-sm font-semibold text-emerald-900">All clear for today.</p>
        <p className="text-[11px] text-emerald-700 mt-0.5">Nothing assigned. Plan ahead or rest up.</p>
      </div>
    </div>
  )
}

function TasksSkeleton() {
  return (
    <div className="relative bg-white border border-gray-200 rounded-xl p-6 overflow-hidden animate-pulse">
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-slate-100" aria-hidden />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-slate-100" />
          <div className="h-3 w-24 bg-slate-100 rounded" />
        </div>
        <div className="h-3 w-16 bg-slate-100 rounded" />
      </div>
      <div className="h-4 w-3/4 bg-slate-100 rounded mt-4" />
      <div className="h-14 w-full bg-slate-100 rounded-lg mt-4" />
      <div className="h-1.5 w-full bg-slate-100 rounded-full mt-4" />
    </div>
  )
}

// ─── Pure helpers (testable, no React) ────────────────────────────────────────

interface DisplayList {
  topTask: DisplayTask | null
  openCount: number
  doneTodayCount: number
}

function buildDisplayList(
  eventTasks: ReadonlyArray<MyTask>,
  personalTasks: ReadonlyArray<PersonalTask>,
): DisplayList {
  const todayStart = startOfToday()
  const tomorrowStart = todayStart + 24 * 60 * 60 * 1000

  const eventDisplay: DisplayTask[] = eventTasks.map((t) => ({
    id: t.id,
    title: t.title,
    dueDate: t.dueDate,
    priority: t.priority,
    source: 'event',
    eventProjectId: t.eventProject.id,
  }))

  const personalDisplay: DisplayTask[] = personalTasks.map((t) => ({
    id: t.id,
    title: t.title,
    dueDate: t.dueDate,
    priority: t.priority,
    source: 'personal',
  }))

  const all = [...eventDisplay, ...personalDisplay]

  const open = all.filter((t, idx) => {
    const original = idx < eventDisplay.length ? eventTasks[idx] : personalTasks[idx - eventDisplay.length]
    return original.status !== 'DONE'
  })

  const doneToday = [...eventTasks, ...personalTasks].filter((t) => {
    if (t.status !== 'DONE') return false
    if (!t.completedAt) return false
    const ts = new Date(t.completedAt).getTime()
    return ts >= todayStart && ts < tomorrowStart
  }).length

  const sorted = [...open].sort(compareTasks)

  return {
    topTask: sorted[0] ?? null,
    openCount: open.length,
    doneTodayCount: doneToday,
  }
}

function compareTasks(a: DisplayTask, b: DisplayTask): number {
  // Critical > High > Normal > Low
  const priorityRank = { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 } as const
  const pa = priorityRank[a.priority]
  const pb = priorityRank[b.priority]
  if (pa !== pb) return pa - pb

  // Then by due date — earliest first; tasks without a due date last
  const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY
  const db = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY
  return da - db
}

function startOfToday(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function formatDueDate(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)

  if (dayStart.getTime() === today.getTime()) return 'Due today'
  if (dayStart.getTime() === tomorrow.getTime()) return 'Due tomorrow'
  if (dayStart.getTime() < today.getTime()) return 'Overdue'

  return `Due ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

interface HeadlineInputs {
  firstName: string
  totalOpen: number
  totalDoneToday: number
}

function buildHeadline({ firstName, totalOpen, totalDoneToday }: HeadlineInputs): string {
  const name = firstName || 'there'

  if (totalOpen === 0 && totalDoneToday === 0) {
    return `A clear runway, ${name}. Plan something or take a breath.`
  }
  if (totalOpen === 0 && totalDoneToday > 0) {
    return `Everything wrapped, ${name}. Nice work today.`
  }
  if (totalOpen === 1) {
    return `One task left to wrap, ${name}. You've got this.`
  }
  if (totalOpen <= 3) {
    return `${spellNumber(totalOpen)} tasks to wrap today. You've got this, ${name}.`
  }
  return `${totalOpen} tasks on deck. Pick one and start, ${name}.`
}

function spellNumber(n: number): string {
  if (n === 2) return 'Two'
  if (n === 3) return 'Three'
  return String(n)
}
