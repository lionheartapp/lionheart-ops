'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  Circle,
  CheckCircle2,
  Clock3,
  CalendarRange,
  MapPin,
  Loader2,
} from 'lucide-react'
import { useUpdateMyTaskStatus, type MyTask, type MyTaskStatus } from '@/lib/hooks/useMyTasks'
import { useToast } from '@/components/Toast'
import { IllustrationTasks } from '@/components/illustrations'

type FilterKey = 'open' | 'todo' | 'in-progress' | 'done'

const FILTERS: { key: FilterKey; label: string; status?: MyTaskStatus }[] = [
  { key: 'open', label: 'Open' },
  { key: 'todo', label: 'To do', status: 'TODO' },
  { key: 'in-progress', label: 'In progress', status: 'IN_PROGRESS' },
  { key: 'done', label: 'Done', status: 'DONE' },
]

interface EventTasksContentProps {
  tasks: MyTask[] | undefined
  isLoading: boolean
}

export default function EventTasksContent({ tasks, isLoading }: EventTasksContentProps) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('open')
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
    <div className="flex flex-col h-full">
      {/* Filter tabs */}
      <div
        className="flex items-center gap-1 border-b border-slate-200 px-1 flex-shrink-0"
        role="tablist"
        aria-label="Event task filters"
      >
        {FILTERS.map((filter) => {
          const isActive = activeFilter === filter.key
          const count = countFor(filter.key, counts)
          return (
            <button
              key={filter.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveFilter(filter.key)}
              className={`relative px-3 py-2 text-sm font-medium transition-colors duration-200 cursor-pointer ${
                isActive ? 'text-indigo-700' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>{filter.label}</span>
              {count > 0 && (
                <span
                  className={`ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full ${
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-1 py-4" role="tabpanel">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin motion-reduce:animate-none mr-2" />
            <span className="text-sm">Loading tasks…</span>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState filter={activeFilter} />
        ) : (
          <div className="space-y-4">
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
      </div>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

interface CountSummary { open: number; todo: number; inProgress: number; done: number }

function countFor(key: FilterKey, counts: CountSummary): number {
  if (key === 'open') return counts.open
  if (key === 'todo') return counts.todo
  if (key === 'in-progress') return counts.inProgress
  return counts.done
}

interface TaskGroup { event: MyTask['eventProject']; tasks: MyTask[] }

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

// ─── Sub-components ─────────────────────────────────────────────────────────

function EventGroup({ group, onToggleComplete, isUpdating }: {
  group: TaskGroup
  onToggleComplete: (task: MyTask) => void
  isUpdating: boolean
}) {
  const { event, tasks } = group
  const locationLabel = formatLocation(event)

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
        <p className="text-sm font-semibold text-slate-900 truncate">{event.title}</p>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
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
    </div>
  )
}

function TaskRow({ task, onToggleComplete, isUpdating }: {
  task: MyTask
  onToggleComplete: () => void
  isUpdating: boolean
}) {
  const isDone = task.status === 'DONE'
  const isOverdue = !!task.dueDate && !isDone && new Date(task.dueDate) < new Date()

  return (
    <li className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors duration-200">
      <button
        type="button"
        onClick={onToggleComplete}
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
  const styles = priority === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
  const label = priority === 'CRITICAL' ? 'Critical' : 'High'
  return (
    <span className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${styles}`}>
      {label}
    </span>
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
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <IllustrationTasks className="w-48 h-40 mx-auto mb-2" />
      <p className="text-base font-semibold text-slate-900 mb-1">{title}</p>
      <p className="text-sm text-stone-500 max-w-xs">{subtitle}</p>
    </div>
  )
}

function formatLocation(event: MyTask['eventProject']): string | null {
  const parts: string[] = []
  if (event.building?.name) parts.push(event.building.name)
  if (event.room) {
    const roomLabel = event.room.displayName ?? event.room.roomNumber
    if (roomLabel) parts.push(roomLabel)
  }
  return parts.length > 0 ? parts.join(' · ') : null
}
