'use client'

import { useMemo, useState, useRef } from 'react'
import { format } from 'date-fns'
import {
  Plus,
  Circle,
  CheckCircle2,
  Clock3,
  Trash2,
  Loader2,
} from 'lucide-react'
import {
  useCreatePersonalTask,
  useUpdatePersonalTask,
  useDeletePersonalTask,
  type PersonalTask,
  type MyTaskStatus,
} from '@/lib/hooks/useMyTasks'
import { useToast } from '@/components/Toast'
import { Input } from '@/components/ui/Input'
import ConfirmDialog from '@/components/ConfirmDialog'
import { IllustrationTasks } from '@/components/illustrations'

type FilterKey = 'open' | 'todo' | 'in-progress' | 'done'

const FILTERS: { key: FilterKey; label: string; status?: MyTaskStatus }[] = [
  { key: 'open', label: 'Open' },
  { key: 'todo', label: 'To do', status: 'TODO' },
  { key: 'in-progress', label: 'In progress', status: 'IN_PROGRESS' },
  { key: 'done', label: 'Done', status: 'DONE' },
]

interface PersonalTasksContentProps {
  tasks: PersonalTask[] | undefined
  isLoading: boolean
}

export default function PersonalTasksContent({ tasks, isLoading }: PersonalTasksContentProps) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('open')
  const [newTitle, setNewTitle] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [taskToDelete, setTaskToDelete] = useState<PersonalTask | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const createTask = useCreatePersonalTask()
  const updateTask = useUpdatePersonalTask()
  const deleteTask = useDeletePersonalTask()
  const { toast } = useToast()

  const filtered = useMemo(() => {
    if (!tasks) return []
    if (activeFilter === 'open') return tasks.filter((t) => t.status !== 'DONE')
    const target = FILTERS.find((f) => f.key === activeFilter)?.status
    return target ? tasks.filter((t) => t.status === target) : tasks
  }, [tasks, activeFilter])

  const counts = useMemo(() => {
    if (!tasks) return { open: 0, todo: 0, inProgress: 0, done: 0 }
    return {
      open: tasks.filter((t) => t.status !== 'DONE').length,
      todo: tasks.filter((t) => t.status === 'TODO').length,
      inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
      done: tasks.filter((t) => t.status === 'DONE').length,
    }
  }, [tasks])

  async function handleAdd() {
    const title = newTitle.trim()
    if (!title) return
    try {
      await createTask.mutateAsync({
        title,
        ...(newDueDate ? { dueDate: new Date(newDueDate).toISOString() } : {}),
      })
      setNewTitle('')
      setNewDueDate('')
      inputRef.current?.focus()
    } catch {
      toast('Failed to create task', 'error')
    }
  }

  async function handleToggleComplete(task: PersonalTask) {
    const nextStatus: MyTaskStatus = task.status === 'DONE' ? 'TODO' : 'DONE'
    try {
      await updateTask.mutateAsync({ taskId: task.id, status: nextStatus })
    } catch {
      toast('Failed to update task', 'error')
    }
  }

  async function handleConfirmDelete() {
    if (!taskToDelete) return
    try {
      await deleteTask.mutateAsync(taskToDelete.id)
      setTaskToDelete(null)
    } catch {
      toast('Failed to delete task', 'error')
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Quick add */}
      <div className="flex items-center gap-2 px-1 py-3 border-b border-slate-200 flex-shrink-0">
        <div className="flex-1">
          <Input
            ref={inputRef}
            type="text"
            placeholder="Add a task…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
            size="sm"
          />
        </div>
        <Input
          type="date"
          value={newDueDate}
          onChange={(e) => setNewDueDate(e.target.value)}
          size="sm"
          className="w-36"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newTitle.trim() || createTask.isPending}
          className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 cursor-pointer"
          aria-label="Add task"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Filter tabs */}
      <div
        className="flex items-center gap-1 border-b border-slate-200 px-1 flex-shrink-0"
        role="tablist"
        aria-label="Personal task filters"
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

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-1 py-4" role="tabpanel">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin motion-reduce:animate-none mr-2" />
            <span className="text-sm">Loading tasks…</span>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState filter={activeFilter} />
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <ul className="divide-y divide-slate-100">
              {filtered.map((task) => (
                <PersonalTaskRow
                  key={task.id}
                  task={task}
                  onToggleComplete={() => handleToggleComplete(task)}
                  onDelete={() => setTaskToDelete(task)}
                  isUpdating={updateTask.isPending}
                />
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
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

// ─── Task row ───────────────────────────────────────────────────────────────

function PersonalTaskRow({ task, onToggleComplete, onDelete, isUpdating }: {
  task: PersonalTask
  onToggleComplete: () => void
  onDelete: () => void
  isUpdating: boolean
}) {
  const isDone = task.status === 'DONE'
  const isOverdue = !!task.dueDate && !isDone && new Date(task.dueDate) < new Date()

  return (
    <li className="group flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors duration-200">
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
          {task.status === 'IN_PROGRESS' && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
              In progress
            </span>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onDelete}
        className="mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-slate-400 hover:text-red-500 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1 rounded"
        aria-label={`Delete task: ${task.title}`}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </li>
  )
}

function PriorityBadge({ priority }: { priority: PersonalTask['priority'] }) {
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
    open: { title: 'No personal tasks', subtitle: 'Add a task above to get started.' },
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
