'use client'

import { useMemo, useState, useRef } from 'react'
import { format, isToday, isPast, isFuture, startOfDay } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CalendarRange,
  Clock3,
  AlertTriangle,
  CheckCircle2,
  Circle,
  ChevronLeft,
  Plus,
  Trash2,
  MapPin,
  User,
  Loader2,
  Sun,
  CalendarClock,
} from 'lucide-react'
import DetailDrawer from '@/components/DetailDrawer'
import ConfirmDialog from '@/components/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { IllustrationTasks } from '@/components/illustrations'
import {
  useMyTasks,
  usePersonalTasks,
  useUpdateMyTaskStatus,
  useCreatePersonalTask,
  useUpdatePersonalTask,
  useDeletePersonalTask,
  type MyTask,
  type PersonalTask,
  type MyTaskStatus,
} from '@/lib/hooks/useMyTasks'
import { useToast } from '@/components/Toast'

// ─── Types ──────────────────────────────────────────────────────────────────

type Screen = 'home' | 'today' | 'upcoming' | 'overdue' | 'done'

type UnifiedTask = {
  id: string
  title: string
  status: MyTaskStatus
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'
  dueDate: string | null
  completedAt: string | null
  category?: string | null
  source: 'event' | 'personal'
  eventProject?: MyTask['eventProject']
  eventProjectId?: string
}

interface MyTasksDrawerProps {
  isOpen: boolean
  onClose: () => void
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function unifyTasks(eventTasks: MyTask[] | undefined, personalTasks: PersonalTask[] | undefined): UnifiedTask[] {
  const unified: UnifiedTask[] = []
  for (const t of eventTasks ?? []) {
    unified.push({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      completedAt: t.completedAt,
      category: t.category,
      source: 'event',
      eventProject: t.eventProject,
      eventProjectId: t.eventProject.id,
    })
  }
  for (const t of personalTasks ?? []) {
    unified.push({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      completedAt: t.completedAt,
      source: 'personal',
    })
  }
  return unified
}

function isDueToday(d: string | null): boolean {
  return !!d && isToday(new Date(d))
}
function isOverdue(d: string | null, status: string): boolean {
  return !!d && status !== 'DONE' && isPast(startOfDay(new Date(d))) && !isToday(new Date(d))
}
function isUpcoming(d: string | null): boolean {
  return !!d && isFuture(startOfDay(new Date(d))) && !isToday(new Date(d))
}

function filterTasks(tasks: UnifiedTask[], screen: Screen): UnifiedTask[] {
  switch (screen) {
    case 'today':
      return tasks.filter((t) => t.status !== 'DONE' && (isDueToday(t.dueDate) || isOverdue(t.dueDate, t.status)))
    case 'upcoming':
      return tasks.filter((t) => t.status !== 'DONE' && isUpcoming(t.dueDate))
    case 'overdue':
      return tasks.filter((t) => isOverdue(t.dueDate, t.status))
    case 'done':
      return tasks.filter((t) => t.status === 'DONE')
    default:
      return tasks.filter((t) => t.status !== 'DONE')
  }
}

interface TaskSection {
  key: string
  label: string
  sublabel?: string
  type: 'event' | 'personal'
  tasks: UnifiedTask[]
}

function groupIntoSections(tasks: UnifiedTask[]): TaskSection[] {
  const eventGroups = new Map<string, { event: MyTask['eventProject']; tasks: UnifiedTask[] }>()
  const personalTasks: UnifiedTask[] = []

  for (const t of tasks) {
    if (t.source === 'event' && t.eventProject) {
      const existing = eventGroups.get(t.eventProjectId!)
      if (existing) {
        existing.tasks.push(t)
      } else {
        eventGroups.set(t.eventProjectId!, { event: t.eventProject, tasks: [t] })
      }
    } else {
      personalTasks.push(t)
    }
  }

  const sections: TaskSection[] = []

  // Sort event groups by start date
  const sorted = Array.from(eventGroups.values()).sort((a, b) => {
    const aDate = a.event.startsAt ? new Date(a.event.startsAt).getTime() : Infinity
    const bDate = b.event.startsAt ? new Date(b.event.startsAt).getTime() : Infinity
    return aDate - bDate
  })

  for (const group of sorted) {
    sections.push({
      key: group.event.id,
      label: group.event.title,
      sublabel: group.event.startsAt ? format(new Date(group.event.startsAt), 'MMM d') : undefined,
      type: 'event',
      tasks: group.tasks,
    })
  }

  if (personalTasks.length > 0) {
    sections.push({
      key: 'personal',
      label: 'Personal',
      type: 'personal',
      tasks: personalTasks,
    })
  }

  return sections
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function MyTasksDrawer({ isOpen, onClose }: MyTasksDrawerProps) {
  const [screen, setScreen] = useState<Screen>('home')
  const [slideDirection, setSlideDirection] = useState<'forward' | 'back'>('forward')
  const [taskToDelete, setTaskToDelete] = useState<UnifiedTask | null>(null)
  const [addingTask, setAddingTask] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const addInputRef = useRef<HTMLInputElement>(null)

  const { toast } = useToast()
  const { data: eventTasks, isLoading: eventLoading } = useMyTasks()
  const { data: personalTasks, isLoading: personalLoading } = usePersonalTasks()
  const updateEventStatus = useUpdateMyTaskStatus()
  const createPersonal = useCreatePersonalTask()
  const updatePersonal = useUpdatePersonalTask()
  const deletePersonal = useDeletePersonalTask()

  const isLoading = eventLoading || personalLoading
  const allTasks = useMemo(() => unifyTasks(eventTasks, personalTasks), [eventTasks, personalTasks])

  // Counts for summary cards
  const counts = useMemo(() => {
    const active = allTasks.filter((t) => t.status !== 'DONE')
    return {
      today: active.filter((t) => isDueToday(t.dueDate) || isOverdue(t.dueDate, t.status)).length,
      upcoming: active.filter((t) => isUpcoming(t.dueDate)).length,
      overdue: active.filter((t) => isOverdue(t.dueDate, t.status)).length,
      done: allTasks.filter((t) => t.status === 'DONE').length,
    }
  }, [allTasks])

  const currentTasks = useMemo(() => filterTasks(allTasks, screen), [allTasks, screen])
  const sections = useMemo(() => groupIntoSections(currentTasks), [currentTasks])

  function navigateTo(s: Screen) {
    setSlideDirection('forward')
    setScreen(s)
  }
  function goHome() {
    setSlideDirection('back')
    setScreen('home')
  }

  async function handleToggle(task: UnifiedTask) {
    const nextStatus: MyTaskStatus = task.status === 'DONE' ? 'TODO' : 'DONE'
    try {
      if (task.source === 'event') {
        await updateEventStatus.mutateAsync({ eventProjectId: task.eventProjectId!, taskId: task.id, status: nextStatus })
      } else {
        await updatePersonal.mutateAsync({ taskId: task.id, status: nextStatus })
      }
    } catch {
      toast('Failed to update task', 'error')
    }
  }

  async function handleAddTask() {
    const title = newTitle.trim()
    if (!title) return
    try {
      await createPersonal.mutateAsync({ title })
      setNewTitle('')
      setAddingTask(false)
    } catch {
      toast('Failed to create task', 'error')
    }
  }

  async function handleConfirmDelete() {
    if (!taskToDelete) return
    try {
      await deletePersonal.mutateAsync(taskToDelete.id)
      setTaskToDelete(null)
    } catch {
      toast('Failed to delete task', 'error')
    }
  }

  const screenLabels: Record<Screen, string> = {
    home: 'My Tasks',
    today: 'Today',
    upcoming: 'Upcoming',
    overdue: 'Overdue',
    done: 'Completed',
  }

  const isUpdating = updateEventStatus.isPending || updatePersonal.isPending

  return (
    <DetailDrawer isOpen={isOpen} onClose={onClose} title="My Tasks" width="lg">
      <div className="flex flex-col h-full -mx-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={screen}
            initial={{ x: slideDirection === 'forward' ? 40 : -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: slideDirection === 'forward' ? -40 : 40, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="flex flex-col h-full"
          >
            {screen === 'home' ? (
              /* ─── Home screen ─── */
              <>
                <div className="flex-1 overflow-y-auto px-1">
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 gap-3 py-4">
                    <SummaryCard
                      icon={Sun}
                      label="Today"
                      count={counts.today}
                      color="blue"
                      onClick={() => navigateTo('today')}
                    />
                    <SummaryCard
                      icon={CalendarClock}
                      label="Upcoming"
                      count={counts.upcoming}
                      color="indigo"
                      onClick={() => navigateTo('upcoming')}
                    />
                    <SummaryCard
                      icon={AlertTriangle}
                      label="Overdue"
                      count={counts.overdue}
                      color="red"
                      onClick={() => navigateTo('overdue')}
                    />
                    <SummaryCard
                      icon={CheckCircle2}
                      label="Done"
                      count={counts.done}
                      color="green"
                      onClick={() => navigateTo('done')}
                    />
                  </div>

                  {/* Task list */}
                  {isLoading ? (
                    <div className="flex items-center justify-center py-16 text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin motion-reduce:animate-none mr-2" />
                      <span className="text-sm">Loading tasks…</span>
                    </div>
                  ) : sections.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <IllustrationTasks className="w-48 h-40 mx-auto mb-2" />
                      <p className="text-base font-semibold text-slate-900 mb-1">All caught up</p>
                      <p className="text-sm text-stone-500 max-w-xs">No open tasks right now. Add a personal task below or wait for event assignments.</p>
                    </div>
                  ) : (
                    <div className="space-y-4 pb-4">
                      {sections.map((section) => (
                        <SectionGroup
                          key={section.key}
                          section={section}
                          onToggle={handleToggle}
                          onDelete={setTaskToDelete}
                          isUpdating={isUpdating}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick add bar */}
                <div className="flex-shrink-0 border-t border-slate-200 px-1 py-3">
                  {addingTask ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <Input
                          ref={addInputRef}
                          type="text"
                          placeholder="Task name…"
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddTask()
                            if (e.key === 'Escape') { setAddingTask(false); setNewTitle('') }
                          }}
                          size="sm"
                          autoFocus
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddTask}
                        disabled={!newTitle.trim() || createPersonal.isPending}
                        className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 cursor-pointer"
                        aria-label="Add task"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingTask(true)}
                      className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer transition-colors duration-200"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add task</span>
                    </button>
                  )}
                </div>
              </>
            ) : (
              /* ─── Filtered screen ─── */
              <>
                <div className="flex items-center gap-2 px-1 py-3 border-b border-slate-200 flex-shrink-0">
                  <button
                    type="button"
                    onClick={goHome}
                    className="p-1.5 -ml-1 rounded-lg hover:bg-slate-100 transition-colors duration-200 cursor-pointer"
                    aria-label="Back to tasks home"
                  >
                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                  </button>
                  <h3 className="text-base font-semibold text-slate-900">{screenLabels[screen]}</h3>
                </div>

                <div className="flex-1 overflow-y-auto px-1 py-4">
                  {sections.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <IllustrationTasks className="w-48 h-40 mx-auto mb-2" />
                      <p className="text-base font-semibold text-slate-900 mb-1">
                        {screen === 'done' ? 'Nothing completed yet' : 'No tasks here'}
                      </p>
                      <p className="text-sm text-stone-500 max-w-xs">
                        {screen === 'overdue' ? 'Great — nothing overdue.' : screen === 'done' ? 'Completed tasks will show up here.' : 'No tasks match this filter.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {sections.map((section) => (
                        <SectionGroup
                          key={section.key}
                          section={section}
                          onToggle={handleToggle}
                          onDelete={setTaskToDelete}
                          isUpdating={isUpdating}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <ConfirmDialog
          isOpen={!!taskToDelete}
          onClose={() => setTaskToDelete(null)}
          onConfirm={handleConfirmDelete}
          title="Delete task"
          message={`Are you sure you want to delete "${taskToDelete?.title}"? This can't be undone.`}
          confirmText="Delete"
          variant="danger"
        />
      </div>
    </DetailDrawer>
  )
}

// ─── Summary card ───────────────────────────────────────────────────────────

const COLOR_MAP = {
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-100',   hover: 'hover:bg-blue-100/60',   icon: 'text-blue-600' },
  indigo: { bg: 'bg-indigo-50', border: 'border-indigo-100', hover: 'hover:bg-indigo-100/60', icon: 'text-indigo-600' },
  red:    { bg: 'bg-red-50',    border: 'border-red-100',    hover: 'hover:bg-red-100/60',    icon: 'text-red-600' },
  green:  { bg: 'bg-green-50',  border: 'border-green-100',  hover: 'hover:bg-green-100/60',  icon: 'text-green-600' },
} as const

function SummaryCard({ icon: Icon, label, count, color, onClick }: {
  icon: typeof Sun
  label: string
  count: number
  color: keyof typeof COLOR_MAP
  onClick: () => void
}) {
  const c = COLOR_MAP[color]
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-3 rounded-xl ${c.bg} border ${c.border} ${c.hover} flex flex-col gap-1 cursor-pointer transition-colors duration-200 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1`}
    >
      <Icon className={`w-4 h-4 ${c.icon}`} />
      <span className="text-2xl font-bold text-slate-900">{count}</span>
      <span className="text-xs text-slate-500">{label}</span>
    </button>
  )
}

// ─── Section group ──────────────────────────────────────────────────────────

function SectionGroup({ section, onToggle, onDelete, isUpdating }: {
  section: TaskSection
  onToggle: (task: UnifiedTask) => void
  onDelete: (task: UnifiedTask) => void
  isUpdating: boolean
}) {
  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-2 px-2 mb-2">
        {section.type === 'event' ? (
          <CalendarRange className="w-3.5 h-3.5 text-slate-400" />
        ) : (
          <User className="w-3.5 h-3.5 text-slate-400" />
        )}
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{section.label}</span>
        {section.sublabel && (
          <span className="text-[11px] text-slate-400">{section.sublabel}</span>
        )}
      </div>

      {/* Task rows */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {section.tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={() => onToggle(task)}
              onDelete={task.source === 'personal' ? () => onDelete(task) : undefined}
              isUpdating={isUpdating}
            />
          ))}
        </ul>
      </div>
    </div>
  )
}

// ─── Task row ───────────────────────────────────────────────────────────────

function TaskRow({ task, onToggle, onDelete, isUpdating }: {
  task: UnifiedTask
  onToggle: () => void
  onDelete?: () => void
  isUpdating: boolean
}) {
  const isDone = task.status === 'DONE'
  const overdue = !!task.dueDate && !isDone && isPast(startOfDay(new Date(task.dueDate))) && !isToday(new Date(task.dueDate))

  return (
    <li className="group flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors duration-200">
      <button
        type="button"
        onClick={onToggle}
        disabled={isUpdating}
        className="mt-0.5 flex-shrink-0 cursor-pointer disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1 rounded-full"
        aria-label={isDone ? 'Mark task as incomplete' : 'Mark task as complete'}
      >
        {isDone ? (
          <CheckCircle2 className="w-5 h-5 text-green-600" />
        ) : (
          <Circle className="w-5 h-5 text-slate-300 hover:text-indigo-500 transition-colors duration-200" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <p className={`text-sm ${isDone ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
            {task.title}
          </p>
          <PriorityBadge priority={task.priority} />
        </div>
        <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
          {task.dueDate && (
            <span className={`inline-flex items-center gap-1 ${overdue ? 'text-red-600 font-medium' : ''}`}>
              <Clock3 className="w-3 h-3" />
              {overdue ? 'Overdue · ' : isDueToday(task.dueDate) ? 'Today · ' : 'Due '}
              {format(new Date(task.dueDate), 'MMM d')}
            </span>
          )}
          {task.category && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
              {task.category}
            </span>
          )}
          {task.status === 'IN_PROGRESS' && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
              In progress
            </span>
          )}
        </div>
      </div>

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-slate-400 hover:text-red-500 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1 rounded"
          aria-label={`Delete task: ${task.title}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </li>
  )
}

function PriorityBadge({ priority }: { priority: UnifiedTask['priority'] }) {
  if (priority === 'NORMAL' || priority === 'LOW') return null
  const styles = priority === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
  const label = priority === 'CRITICAL' ? 'Critical' : 'High'
  return (
    <span className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${styles}`}>
      {label}
    </span>
  )
}
