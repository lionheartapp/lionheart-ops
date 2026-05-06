'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { motion } from 'framer-motion'
import {
  CheckSquare,
  Circle,
  CheckCircle2,
  Clock3,
  CalendarRange,
  MapPin,
  Inbox,
  Loader2,
} from 'lucide-react'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuth } from '@/lib/hooks/useAuth'
import { useMyTasks, useUpdateMyTaskStatus, type MyTask, type MyTaskStatus } from '@/lib/hooks/useMyTasks'
import { useToast } from '@/components/Toast'
import { fadeInUp, staggerContainer } from '@/lib/animations'

// ─── Filter tabs ────────────────────────────────────────────────────────────

type FilterKey = 'open' | 'todo' | 'in-progress' | 'done'

const FILTERS: { key: FilterKey; label: string; status?: MyTaskStatus }[] = [
  { key: 'open', label: 'Open' },
  { key: 'todo', label: 'To do', status: 'TODO' },
  { key: 'in-progress', label: 'In progress', status: 'IN_PROGRESS' },
  { key: 'done', label: 'Done', status: 'DONE' },
]

// ─── Page ───────────────────────────────────────────────────────────────────

export default function MyTasksPage() {
  const { user, org, logout } = useAuth()
  const [activeFilter, setActiveFilter] = useState<FilterKey>('open')
  const { data: tasks, isLoading } = useMyTasks()
  const updateStatus = useUpdateMyTaskStatus()
  const { toast } = useToast()

  const filtered = useMemo(() => {
    if (!tasks) return []
    if (activeFilter === 'open') return tasks.filter((t) => t.status !== 'DONE')
    const target = FILTERS.find((f) => f.key === activeFilter)?.status
    return target ? tasks.filter((t) => t.status === target) : tasks
  }, [tasks, activeFilter])

  const grouped = useMemo(() => groupByEvent(filtered), [filtered])

  const counts = useMemo(() => {
    if (!tasks) return { open: 0, todo: 0, inProgress: 0, done: 0 }
    return {
      open: tasks.filter((t) => t.status !== 'DONE').length,
      todo: tasks.filter((t) => t.status === 'TODO').length,
      inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
      done: tasks.filter((t) => t.status === 'DONE').length,
    }
  }, [tasks])

  async function handleToggleComplete(task: MyTask) {
    const nextStatus: MyTaskStatus = task.status === 'DONE' ? 'TODO' : 'DONE'
    try {
      await updateStatus.mutateAsync({
        eventProjectId: task.eventProject.id,
        taskId: task.id,
        status: nextStatus,
      })
    } catch {
      toast('Failed to update task', 'error')
    }
  }

  return (
    <DashboardLayout
      userName={user?.name || 'User'}
      userEmail={user?.email || 'user@school.edu'}
      userAvatar={user?.avatar || undefined}
      organizationName={org?.name || 'School'}
      organizationLogoUrl={org?.logoUrl || undefined}
      onLogout={logout}
    >
      <div className="max-w-5xl mx-auto px-6 py-8">
        <PageHeader counts={counts} />

        <FilterTabs
          active={activeFilter}
          onChange={setActiveFilter}
          counts={counts}
        />

        <motion.div
          variants={staggerContainer(0.05)}
          initial="hidden"
          animate="visible"
          className="mt-6"
        >
          {isLoading ? (
            <LoadingState />
          ) : filtered.length === 0 ? (
            <EmptyState filter={activeFilter} />
          ) : (
            <div className="space-y-6">
              {grouped.map((group) => (
                <EventGroup
                  key={group.event.id}
                  group={group}
                  onToggleComplete={handleToggleComplete}
                  isUpdating={updateStatus.isPending}
                />
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </DashboardLayout>
  )
}

// ─── Header ─────────────────────────────────────────────────────────────────

interface CountSummary {
  open: number
  todo: number
  inProgress: number
  done: number
}

function PageHeader({ counts }: { counts: CountSummary }) {
  return (
    <motion.div initial="hidden" animate="visible" variants={fadeInUp} className="mb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
          <CheckSquare className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My tasks</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {counts.open === 0
              ? "You're all caught up."
              : `${counts.open} open ${counts.open === 1 ? 'task' : 'tasks'} across your events.`}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Filter tabs ────────────────────────────────────────────────────────────

interface FilterTabsProps {
  active: FilterKey
  onChange: (key: FilterKey) => void
  counts: CountSummary
}

function FilterTabs({ active, onChange, counts }: FilterTabsProps) {
  function countFor(key: FilterKey): number {
    if (key === 'open') return counts.open
    if (key === 'todo') return counts.todo
    if (key === 'in-progress') return counts.inProgress
    return counts.done
  }

  return (
    <div className="flex items-center gap-1 border-b border-slate-200">
      {FILTERS.map((filter) => {
        const isActive = active === filter.key
        const count = countFor(filter.key)
        return (
          <button
            key={filter.key}
            type="button"
            onClick={() => onChange(filter.key)}
            className={`relative px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
              isActive
                ? 'text-indigo-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>{filter.label}</span>
            {count > 0 && (
              <span
                className={`ml-2 text-[11px] px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {count}
              </span>
            )}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Group by event ─────────────────────────────────────────────────────────

interface TaskGroup {
  event: MyTask['eventProject']
  tasks: MyTask[]
}

function groupByEvent(tasks: MyTask[]): TaskGroup[] {
  const map = new Map<string, TaskGroup>()
  for (const task of tasks) {
    const existing = map.get(task.eventProject.id)
    if (existing) {
      existing.tasks.push(task)
    } else {
      map.set(task.eventProject.id, { event: task.eventProject, tasks: [task] })
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const aDate = a.event.startsAt ? new Date(a.event.startsAt).getTime() : Infinity
    const bDate = b.event.startsAt ? new Date(b.event.startsAt).getTime() : Infinity
    return aDate - bDate
  })
}

interface EventGroupProps {
  group: TaskGroup
  onToggleComplete: (task: MyTask) => void
  isUpdating: boolean
}

function EventGroup({ group, onToggleComplete, isUpdating }: EventGroupProps) {
  const { event, tasks } = group
  const locationLabel = formatLocation(event)

  return (
    <motion.div variants={fadeInUp} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100">
        <p className="text-sm font-semibold text-slate-900 truncate">{event.title}</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
          {event.startsAt && (
            <span className="inline-flex items-center gap-1">
              <CalendarRange className="w-3 h-3" />
              {format(new Date(event.startsAt), 'MMM d, yyyy')}
            </span>
          )}
          {locationLabel && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {locationLabel}
            </span>
          )}
        </div>
      </div>

      <ul className="divide-y divide-slate-100">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onToggleComplete={() => onToggleComplete(task)}
            isUpdating={isUpdating}
          />
        ))}
      </ul>
    </motion.div>
  )
}

// ─── Task row ───────────────────────────────────────────────────────────────

interface TaskRowProps {
  task: MyTask
  onToggleComplete: () => void
  isUpdating: boolean
}

function TaskRow({ task, onToggleComplete, isUpdating }: TaskRowProps) {
  const isDone = task.status === 'DONE'
  const isOverdue = !!task.dueDate && !isDone && new Date(task.dueDate) < new Date()

  return (
    <li className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
      <button
        type="button"
        onClick={onToggleComplete}
        disabled={isUpdating}
        className="mt-0.5 flex-shrink-0 cursor-pointer disabled:cursor-wait"
        aria-label={isDone ? 'Mark task as incomplete' : 'Mark task as complete'}
      >
        {isDone ? (
          <CheckCircle2 className="w-5 h-5 text-green-600" />
        ) : (
          <Circle className="w-5 h-5 text-slate-300 hover:text-indigo-500 transition-colors" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <p
            className={`text-sm ${isDone ? 'text-slate-400 line-through' : 'text-slate-900'}`}
          >
            {task.title}
          </p>
          <PriorityBadge priority={task.priority} />
        </div>
        {task.description && (
          <p className={`text-xs mt-1 leading-relaxed ${isDone ? 'text-slate-400' : 'text-slate-500'}`}>
            {task.description}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
          {task.dueDate && (
            <span className={`inline-flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
              <Clock3 className="w-3 h-3" />
              {isOverdue ? 'Overdue · ' : 'Due '}
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
    </li>
  )
}

function PriorityBadge({ priority }: { priority: MyTask['priority'] }) {
  if (priority === 'NORMAL' || priority === 'LOW') return null
  const styles =
    priority === 'CRITICAL'
      ? 'bg-red-100 text-red-700'
      : 'bg-orange-100 text-orange-700'
  const label = priority === 'CRITICAL' ? 'Critical' : 'High'
  return (
    <span className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${styles}`}>
      {label}
    </span>
  )
}

// ─── States ─────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16 text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin mr-2" />
      <span className="text-sm">Loading your tasks…</span>
    </div>
  )
}

function EmptyState({ filter }: { filter: FilterKey }) {
  const messages: Record<FilterKey, { title: string; subtitle: string }> = {
    open: { title: 'No open tasks', subtitle: 'When someone assigns you a task, it shows up here.' },
    todo: { title: 'Nothing to do', subtitle: 'No tasks in the to-do column.' },
    'in-progress': { title: 'Nothing in progress', subtitle: 'Tasks you start working on will appear here.' },
    done: { title: 'Nothing completed yet', subtitle: 'Completed tasks will collect here.' },
  }
  const { title, subtitle } = messages[filter]
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
        <Inbox className="w-6 h-6 text-slate-400" />
      </div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="text-xs text-slate-500 mt-1 max-w-xs">{subtitle}</p>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatLocation(event: MyTask['eventProject']): string | null {
  const parts: string[] = []
  if (event.building?.name) parts.push(event.building.name)
  if (event.room) {
    const roomLabel = event.room.displayName ?? event.room.roomNumber
    if (roomLabel) parts.push(roomLabel)
  }
  return parts.length > 0 ? parts.join(' · ') : null
}
