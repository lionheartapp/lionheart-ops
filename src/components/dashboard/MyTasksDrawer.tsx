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
  ChevronRight,
  Plus,
  Trash2,
  User,
  Loader2,
  Sun,
  CalendarClock,
  Flag,
} from 'lucide-react'
import DetailDrawer from '@/components/DetailDrawer'
import ConfirmDialog from '@/components/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
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
  type PersonalSubtask,
  type MyTaskStatus,
} from '@/lib/hooks/useMyTasks'
import { useToast } from '@/components/Toast'

// ─── Types ──────────────────────────────────────────────────────────────────

type Screen = 'home' | 'today' | 'upcoming' | 'overdue' | 'done' | 'detail'

type UnifiedTask = {
  id: string
  title: string
  description?: string | null
  status: MyTaskStatus
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'
  dueDate: string | null
  completedAt: string | null
  category?: string | null
  source: 'event' | 'personal'
  eventProject?: MyTask['eventProject']
  eventProjectId?: string
  subtasks?: PersonalSubtask[]
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
      id: t.id, title: t.title, description: t.description, status: t.status, priority: t.priority,
      dueDate: t.dueDate, completedAt: t.completedAt, category: t.category,
      source: 'event', eventProject: t.eventProject, eventProjectId: t.eventProject.id,
    })
  }
  for (const t of personalTasks ?? []) {
    unified.push({
      id: t.id, title: t.title, description: t.description, status: t.status, priority: t.priority,
      dueDate: t.dueDate, completedAt: t.completedAt, source: 'personal', subtasks: t.subtasks,
    })
  }
  return unified
}

function isDueToday(d: string | null): boolean { return !!d && isToday(new Date(d)) }
function isOverdue(d: string | null, status: string): boolean {
  return !!d && status !== 'DONE' && isPast(startOfDay(new Date(d))) && !isToday(new Date(d))
}
function isUpcoming(d: string | null): boolean {
  return !!d && isFuture(startOfDay(new Date(d))) && !isToday(new Date(d))
}

function filterTasks(tasks: UnifiedTask[], screen: Screen): UnifiedTask[] {
  switch (screen) {
    case 'today': return tasks.filter((t) => t.status !== 'DONE' && (isDueToday(t.dueDate) || isOverdue(t.dueDate, t.status)))
    case 'upcoming': return tasks.filter((t) => t.status !== 'DONE' && isUpcoming(t.dueDate))
    case 'overdue': return tasks.filter((t) => isOverdue(t.dueDate, t.status))
    case 'done': return tasks.filter((t) => t.status === 'DONE')
    default: return tasks.filter((t) => t.status !== 'DONE')
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
      if (existing) existing.tasks.push(t)
      else eventGroups.set(t.eventProjectId!, { event: t.eventProject, tasks: [t] })
    } else {
      personalTasks.push(t)
    }
  }
  const sections: TaskSection[] = []
  const sorted = Array.from(eventGroups.values()).sort((a, b) => {
    const aD = a.event.startsAt ? new Date(a.event.startsAt).getTime() : Infinity
    const bD = b.event.startsAt ? new Date(b.event.startsAt).getTime() : Infinity
    return aD - bD
  })
  for (const g of sorted) {
    sections.push({ key: g.event.id, label: g.event.title, sublabel: g.event.startsAt ? format(new Date(g.event.startsAt), 'MMM d') : undefined, type: 'event', tasks: g.tasks })
  }
  if (personalTasks.length > 0) {
    sections.push({ key: 'personal', label: 'Personal', type: 'personal', tasks: personalTasks })
  }
  return sections
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function MyTasksDrawer({ isOpen, onClose }: MyTasksDrawerProps) {
  const [screen, setScreen] = useState<Screen>('home')
  const [prevScreen, setPrevScreen] = useState<Screen>('home')
  const [slideDirection, setSlideDirection] = useState<'forward' | 'back'>('forward')
  const [selectedTask, setSelectedTask] = useState<UnifiedTask | null>(null)
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

  // Keep selectedTask in sync with latest data
  const liveTask = useMemo(() => {
    if (!selectedTask) return null
    return allTasks.find((t) => t.id === selectedTask.id) ?? selectedTask
  }, [allTasks, selectedTask])

  function navigateTo(s: Screen) {
    setSlideDirection('forward')
    setPrevScreen(screen)
    setScreen(s)
  }
  function goBack() {
    setSlideDirection('back')
    if (screen === 'detail') setScreen(prevScreen)
    else setScreen('home')
  }
  function openDetail(task: UnifiedTask) {
    setSelectedTask(task)
    navigateTo('detail')
  }

  async function handleToggle(task: UnifiedTask) {
    const nextStatus: MyTaskStatus = task.status === 'DONE' ? 'TODO' : 'DONE'
    try {
      if (task.source === 'event') {
        await updateEventStatus.mutateAsync({ eventProjectId: task.eventProjectId!, taskId: task.id, status: nextStatus })
      } else {
        await updatePersonal.mutateAsync({ taskId: task.id, status: nextStatus })
      }
    } catch { toast('Failed to update task', 'error') }
  }

  async function handleAddTask() {
    const title = newTitle.trim()
    if (!title) return
    try {
      await createPersonal.mutateAsync({ title })
      setNewTitle('')
      setAddingTask(false)
    } catch { toast('Failed to create task', 'error') }
  }

  async function handleConfirmDelete() {
    if (!taskToDelete) return
    try {
      await deletePersonal.mutateAsync(taskToDelete.id)
      setTaskToDelete(null)
      if (screen === 'detail') goBack()
    } catch { toast('Failed to delete task', 'error') }
  }

  const screenLabels: Record<Screen, string> = {
    home: 'My Tasks', today: 'Today', upcoming: 'Upcoming', overdue: 'Overdue', done: 'Completed', detail: '',
  }
  const isUpdating = updateEventStatus.isPending || updatePersonal.isPending

  return (
    <DetailDrawer isOpen={isOpen} onClose={onClose} title="My Tasks" width="lg">
      <div className="flex flex-col h-full -mx-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={screen === 'detail' ? `detail-${selectedTask?.id}` : screen}
            initial={{ x: slideDirection === 'forward' ? 40 : -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: slideDirection === 'forward' ? -40 : 40, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="flex flex-col h-full"
          >
            {screen === 'detail' && liveTask ? (
              <TaskDetailScreen
                task={liveTask}
                onBack={goBack}
                onToggle={() => handleToggle(liveTask)}
                onUpdate={async (data) => {
                  try {
                    if (liveTask.source === 'personal') {
                      await updatePersonal.mutateAsync({ taskId: liveTask.id, ...data })
                    }
                  } catch { toast('Failed to update', 'error') }
                }}
                onDelete={liveTask.source === 'personal' ? () => setTaskToDelete(liveTask) : undefined}
                onAddSubtask={async (title) => {
                  try {
                    await createPersonal.mutateAsync({ title, parentId: liveTask.id })
                  } catch { toast('Failed to add subtask', 'error') }
                }}
                onToggleSubtask={async (subtaskId, done) => {
                  try {
                    await updatePersonal.mutateAsync({ taskId: subtaskId, status: done ? 'DONE' : 'TODO' })
                  } catch { toast('Failed to update subtask', 'error') }
                }}
                onDeleteSubtask={async (subtaskId) => {
                  try {
                    await deletePersonal.mutateAsync(subtaskId)
                  } catch { toast('Failed to delete subtask', 'error') }
                }}
                isUpdating={isUpdating}
              />
            ) : screen === 'home' ? (
              <>
                <div className="flex-1 overflow-y-auto px-1">
                  <div className="grid grid-cols-2 gap-3 py-4">
                    <SummaryCard icon={Sun} label="Today" count={counts.today} color="blue" onClick={() => navigateTo('today')} />
                    <SummaryCard icon={CalendarClock} label="Upcoming" count={counts.upcoming} color="indigo" onClick={() => navigateTo('upcoming')} />
                    <SummaryCard icon={AlertTriangle} label="Overdue" count={counts.overdue} color="red" onClick={() => navigateTo('overdue')} />
                    <SummaryCard icon={CheckCircle2} label="Done" count={counts.done} color="green" onClick={() => navigateTo('done')} />
                  </div>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-16 text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin motion-reduce:animate-none mr-2" />
                      <span className="text-sm">Loading tasks…</span>
                    </div>
                  ) : sections.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <IllustrationTasks className="w-48 h-40 mx-auto mb-2" />
                      <p className="text-base font-semibold text-slate-900 mb-1">All caught up</p>
                      <p className="text-sm text-stone-500 max-w-xs">No open tasks right now. Add a personal task below.</p>
                    </div>
                  ) : (
                    <div className="space-y-4 pb-4">
                      {sections.map((s) => (
                        <SectionGroup key={s.key} section={s} onToggle={handleToggle} onOpen={openDetail} isUpdating={isUpdating} />
                      ))}
                    </div>
                  )}
                </div>
                <QuickAddBar
                  adding={addingTask}
                  title={newTitle}
                  isPending={createPersonal.isPending}
                  onStartAdd={() => setAddingTask(true)}
                  onTitleChange={setNewTitle}
                  onSubmit={handleAddTask}
                  onCancel={() => { setAddingTask(false); setNewTitle('') }}
                />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 px-1 py-3 border-b border-slate-200 flex-shrink-0">
                  <button type="button" onClick={goBack} className="p-1.5 -ml-1 rounded-lg hover:bg-slate-100 transition-colors duration-200 cursor-pointer" aria-label="Back">
                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                  </button>
                  <h3 className="text-base font-semibold text-slate-900">{screenLabels[screen]}</h3>
                </div>
                <div className="flex-1 overflow-y-auto px-1 py-4">
                  {sections.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <IllustrationTasks className="w-48 h-40 mx-auto mb-2" />
                      <p className="text-base font-semibold text-slate-900 mb-1">{screen === 'done' ? 'Nothing completed yet' : 'No tasks here'}</p>
                      <p className="text-sm text-stone-500 max-w-xs">{screen === 'overdue' ? 'Great — nothing overdue.' : 'No tasks match this filter.'}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {sections.map((s) => (
                        <SectionGroup key={s.key} section={s} onToggle={handleToggle} onOpen={openDetail} isUpdating={isUpdating} />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <ConfirmDialog isOpen={!!taskToDelete} onClose={() => setTaskToDelete(null)} onConfirm={handleConfirmDelete}
          title="Delete task" message={`Are you sure you want to delete "${taskToDelete?.title}"? This can't be undone.`}
          confirmText="Delete" variant="danger" />
      </div>
    </DetailDrawer>
  )
}

// ─── Quick add bar ──────────────────────────────────────────────────────────

function QuickAddBar({ adding, title, isPending, onStartAdd, onTitleChange, onSubmit, onCancel }: {
  adding: boolean; title: string; isPending: boolean
  onStartAdd: () => void; onTitleChange: (v: string) => void; onSubmit: () => void; onCancel: () => void
}) {
  return (
    <div className="flex-shrink-0 border-t border-slate-200 px-1 py-3">
      {adding ? (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Input type="text" placeholder="Task name…" value={title} onChange={(e) => onTitleChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); if (e.key === 'Escape') onCancel() }}
              size="sm" autoFocus />
          </div>
          <button type="button" onClick={onSubmit} disabled={!title.trim() || isPending}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 cursor-pointer"
            aria-label="Add task">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={onStartAdd}
          className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer transition-colors duration-200">
          <Plus className="w-4 h-4" /><span>Add task</span>
        </button>
      )}
    </div>
  )
}

// ─── Summary card ───────────────────────────────────────────────────────────

const COLOR_MAP = {
  blue:   { bg: 'bg-blue-50', border: 'border-blue-100', hover: 'hover:bg-blue-100/60', icon: 'text-blue-600' },
  indigo: { bg: 'bg-indigo-50', border: 'border-indigo-100', hover: 'hover:bg-indigo-100/60', icon: 'text-indigo-600' },
  red:    { bg: 'bg-red-50', border: 'border-red-100', hover: 'hover:bg-red-100/60', icon: 'text-red-600' },
  green:  { bg: 'bg-green-50', border: 'border-green-100', hover: 'hover:bg-green-100/60', icon: 'text-green-600' },
} as const

function SummaryCard({ icon: Icon, label, count, color, onClick }: {
  icon: typeof Sun; label: string; count: number; color: keyof typeof COLOR_MAP; onClick: () => void
}) {
  const c = COLOR_MAP[color]
  return (
    <button type="button" onClick={onClick}
      className={`p-3 rounded-xl ${c.bg} border ${c.border} ${c.hover} flex flex-col gap-1 cursor-pointer transition-colors duration-200 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1`}>
      <Icon className={`w-4 h-4 ${c.icon}`} />
      <span className="text-2xl font-bold text-slate-900">{count}</span>
      <span className="text-xs text-slate-500">{label}</span>
    </button>
  )
}

// ─── Section group ──────────────────────────────────────────────────────────

function SectionGroup({ section, onToggle, onOpen, isUpdating }: {
  section: TaskSection; onToggle: (t: UnifiedTask) => void; onOpen: (t: UnifiedTask) => void; isUpdating: boolean
}) {
  return (
    <div>
      <div className="flex items-center gap-2 px-2 mb-2">
        {section.type === 'event' ? <CalendarRange className="w-3.5 h-3.5 text-slate-400" /> : <User className="w-3.5 h-3.5 text-slate-400" />}
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{section.label}</span>
        {section.sublabel && <span className="text-[11px] text-slate-400">{section.sublabel}</span>}
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {section.tasks.map((task) => (
            <TaskRow key={task.id} task={task} onToggle={() => onToggle(task)} onOpen={() => onOpen(task)} isUpdating={isUpdating} />
          ))}
        </ul>
      </div>
    </div>
  )
}

// ─── Task row ───────────────────────────────────────────────────────────────

function TaskRow({ task, onToggle, onOpen, isUpdating }: {
  task: UnifiedTask; onToggle: () => void; onOpen: () => void; isUpdating: boolean
}) {
  const isDone = task.status === 'DONE'
  const overdue = isOverdue(task.dueDate, task.status)
  const subtaskCount = task.subtasks?.length ?? 0
  const subtaskDone = task.subtasks?.filter((s) => s.status === 'DONE').length ?? 0

  return (
    <li className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors duration-200 cursor-pointer" onClick={onOpen}>
      <button type="button" onClick={(e) => { e.stopPropagation(); onToggle() }} disabled={isUpdating}
        className="mt-0.5 flex-shrink-0 cursor-pointer disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-full"
        aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}>
        {isDone ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <Circle className="w-5 h-5 text-slate-300 hover:text-indigo-500 transition-colors" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${isDone ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{task.title}</p>
        <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
          {task.dueDate && (
            <span className={`inline-flex items-center gap-1 ${overdue ? 'text-red-600 font-medium' : ''}`}>
              <Clock3 className="w-3 h-3" />
              {overdue ? 'Overdue · ' : isDueToday(task.dueDate) ? 'Today · ' : 'Due '}
              {format(new Date(task.dueDate), 'MMM d')}
            </span>
          )}
          {task.category && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{task.category}</span>}
          {subtaskCount > 0 && <span className="text-slate-400">{subtaskDone}/{subtaskCount} subtasks</span>}
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-0.5">
        <PriorityBadge priority={task.priority} />
        <ChevronRight className="w-4 h-4 text-slate-300" />
      </div>
    </li>
  )
}

// ─── Task detail screen ─────────────────────────────────────────────────────

function TaskDetailScreen({ task, onBack, onToggle, onUpdate, onDelete, onAddSubtask, onToggleSubtask, onDeleteSubtask, isUpdating }: {
  task: UnifiedTask
  onBack: () => void
  onToggle: () => void
  onUpdate: (data: { title?: string; description?: string | null; priority?: string; dueDate?: string | null }) => Promise<void>
  onDelete?: () => void
  onAddSubtask: (title: string) => Promise<void>
  onToggleSubtask: (id: string, done: boolean) => Promise<void>
  onDeleteSubtask: (id: string) => Promise<void>
  isUpdating: boolean
}) {
  const isPersonal = task.source === 'personal'
  const isDone = task.status === 'DONE'
  const [newSubtask, setNewSubtask] = useState('')
  const [addingSubtask, setAddingSubtask] = useState(false)

  const priorities: { value: UnifiedTask['priority']; label: string; color: string; activeColor: string }[] = [
    { value: 'LOW', label: 'Low', color: 'text-slate-500 border-slate-200 hover:bg-slate-50', activeColor: 'bg-slate-100 text-slate-700 border-slate-300' },
    { value: 'NORMAL', label: 'Normal', color: 'text-slate-500 border-slate-200 hover:bg-slate-50', activeColor: 'bg-blue-50 text-blue-700 border-blue-200' },
    { value: 'HIGH', label: 'High', color: 'text-slate-500 border-slate-200 hover:bg-slate-50', activeColor: 'bg-orange-50 text-orange-700 border-orange-200' },
    { value: 'CRITICAL', label: 'Critical', color: 'text-slate-500 border-slate-200 hover:bg-slate-50', activeColor: 'bg-red-50 text-red-700 border-red-200' },
  ]

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-2 px-1 py-3 border-b border-slate-200 flex-shrink-0">
        <button type="button" onClick={onBack} className="p-1.5 -ml-1 rounded-lg hover:bg-slate-100 transition-colors duration-200 cursor-pointer" aria-label="Back">
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          {task.source === 'event' ? 'Event Task' : 'Personal Task'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-1 py-4">
        <div className="space-y-5">
          {/* Title + status toggle */}
          <div className="flex items-start gap-3">
            <button type="button" onClick={onToggle} disabled={isUpdating}
              className="mt-1 flex-shrink-0 cursor-pointer disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-full"
              aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}>
              {isDone ? <CheckCircle2 className="w-6 h-6 text-green-600" /> : <Circle className="w-6 h-6 text-slate-300 hover:text-indigo-500 transition-colors" />}
            </button>
            {isPersonal ? (
              <input
                type="text"
                defaultValue={task.title}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v && v !== task.title) onUpdate({ title: v })
                }}
                className={`flex-1 text-lg font-semibold bg-transparent border-none outline-none ${isDone ? 'text-slate-400 line-through' : 'text-slate-900'}`}
              />
            ) : (
              <p className={`flex-1 text-lg font-semibold ${isDone ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{task.title}</p>
            )}
          </div>

          {/* Due date */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
              <Clock3 className="w-3.5 h-3.5" /> Due date
            </label>
            {isPersonal ? (
              <Input
                type="date"
                size="sm"
                defaultValue={task.dueDate ? format(new Date(task.dueDate), 'yyyy-MM-dd') : ''}
                onChange={(e) => {
                  const v = e.target.value
                  onUpdate({ dueDate: v ? new Date(v).toISOString() : null })
                }}
              />
            ) : (
              <p className="text-sm text-slate-700">
                {task.dueDate ? format(new Date(task.dueDate), 'MMMM d, yyyy') : 'No due date'}
              </p>
            )}
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
              <Flag className="w-3.5 h-3.5" /> Priority
            </label>
            {isPersonal ? (
              <div className="flex gap-2">
                {priorities.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => onUpdate({ priority: p.value })}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors duration-200 cursor-pointer ${
                      task.priority === p.value ? p.activeColor : p.color
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            ) : (
              <PriorityBadge priority={task.priority} />
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Description</label>
            {isPersonal ? (
              <Textarea
                defaultValue={task.description ?? ''}
                placeholder="Add a description…"
                rows={3}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v !== (task.description ?? '')) onUpdate({ description: v || null })
                }}
              />
            ) : (
              <p className="text-sm text-slate-700">{task.description || 'No description'}</p>
            )}
          </div>

          {/* Event context */}
          {task.eventProject && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Event</label>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <CalendarRange className="w-4 h-4 text-slate-400" />
                <span>{task.eventProject.title}</span>
              </div>
            </div>
          )}

          {/* Subtasks (personal only) */}
          {isPersonal && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500">Subtasks</label>
              {(task.subtasks && task.subtasks.length > 0) && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <ul className="divide-y divide-slate-100">
                    {task.subtasks.map((sub) => {
                      const subDone = sub.status === 'DONE'
                      return (
                        <li key={sub.id} className="group flex items-center gap-3 px-3 py-2 hover:bg-slate-50 transition-colors">
                          <button type="button" onClick={() => onToggleSubtask(sub.id, !subDone)}
                            className="flex-shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-full"
                            aria-label={subDone ? 'Mark subtask incomplete' : 'Mark subtask complete'}>
                            {subDone ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Circle className="w-4 h-4 text-slate-300 hover:text-indigo-500 transition-colors" />}
                          </button>
                          <span className={`flex-1 text-sm ${subDone ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{sub.title}</span>
                          <button type="button" onClick={() => onDeleteSubtask(sub.id)}
                            className="flex-shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-slate-400 hover:text-red-500 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded"
                            aria-label={`Delete subtask: ${sub.title}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
              {addingSubtask ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Input type="text" placeholder="Subtask name…" value={newSubtask} size="sm" autoFocus
                      onChange={(e) => setNewSubtask(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newSubtask.trim()) { onAddSubtask(newSubtask.trim()); setNewSubtask('') }
                        if (e.key === 'Escape') { setAddingSubtask(false); setNewSubtask('') }
                      }} />
                  </div>
                  <button type="button" onClick={() => { if (newSubtask.trim()) { onAddSubtask(newSubtask.trim()); setNewSubtask('') } }}
                    disabled={!newSubtask.trim()}
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    aria-label="Add subtask">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setAddingSubtask(true)}
                  className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer transition-colors">
                  <Plus className="w-3.5 h-3.5" /><span>Add subtask</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete footer (personal only) */}
      {onDelete && (
        <div className="flex-shrink-0 border-t border-slate-200 px-1 py-3">
          <button type="button" onClick={onDelete}
            className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 font-medium cursor-pointer transition-colors duration-200">
            <Trash2 className="w-4 h-4" /><span>Delete task</span>
          </button>
        </div>
      )}
    </>
  )
}

// ─── Shared ─────────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: UnifiedTask['priority'] }) {
  if (priority === 'NORMAL' || priority === 'LOW') return null
  const styles = priority === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
  const label = priority === 'CRITICAL' ? 'Critical' : 'High'
  return <span className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${styles}`}>{label}</span>
}
