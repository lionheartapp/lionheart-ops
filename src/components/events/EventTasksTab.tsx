'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, isPast, parseISO } from 'date-fns'
import {
  CheckSquare,
  Plus,
  Circle,
  CheckCircle2,
  AlertCircle,
  Lock,
  Pencil,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  User,
} from 'lucide-react'
import { staggerContainer, listItem, fadeInUp } from '@/lib/animations'
import {
  useEventTasks,
  useCreateEventTask,
  useUpdateEventTask,
  useDeleteEventTask,
} from '@/lib/hooks/useEventTasks'
import { type EventTask } from '@/lib/hooks/useEventProject'
import { useToast } from '@/components/Toast'
import type { CreateEventTaskInput, UpdateEventTaskInput } from '@/lib/types/event-project'

// ─── Priority config ─────────────────────────────────────────────────────────

const PRIORITIES = [
  { value: 'CRITICAL', label: 'Critical', color: 'text-red-700', bg: 'bg-red-100' },
  { value: 'HIGH', label: 'High', color: 'text-orange-700', bg: 'bg-orange-100' },
  { value: 'NORMAL', label: 'Normal', color: 'text-blue-700', bg: 'bg-blue-100' },
  { value: 'LOW', label: 'Low', color: 'text-slate-600', bg: 'bg-slate-100' },
] as const

type PriorityValue = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW'
type StatusValue = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE'

function getPriorityConfig(priority: string) {
  return PRIORITIES.find((p) => p.value === priority) ?? PRIORITIES[2]
}

const TASK_CATEGORIES = [
  'Logistics', 'Communications', 'Venue', 'Volunteers',
  'Catering', 'A/V', 'Transportation', 'Other',
]

// ─── Status icon ─────────────────────────────────────────────────────────────

function StatusIcon({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'
  switch (status) {
    case 'DONE':
      return <CheckCircle2 className={`${cls} text-green-500`} />
    case 'IN_PROGRESS':
      return <AlertCircle className={`${cls} text-blue-500`} />
    case 'BLOCKED':
      return <Lock className={`${cls} text-red-500`} />
    default:
      return <Circle className={`${cls} text-slate-300`} />
  }
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function TasksSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="bg-slate-100 rounded-xl h-14" />
      ))}
    </div>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function TasksEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="text-center py-12">
      <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
        <CheckSquare className="w-7 h-7 text-indigo-500" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-2">No tasks yet</h3>
      <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
        Create tasks to track everything that needs to happen for this event.
      </p>
      <button
        onClick={onAdd}
        className="px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer"
      >
        Add First Task
      </button>
    </motion.div>
  )
}

// ─── Task Form ────────────────────────────────────────────────────────────────

interface TaskFormData {
  title: string
  description: string
  priority: PriorityValue
  category: string
  dueDate: string
}

const defaultTaskForm: TaskFormData = {
  title: '',
  description: '',
  priority: 'NORMAL',
  category: '',
  dueDate: '',
}

interface TaskFormProps {
  initialData?: Partial<TaskFormData>
  onSubmit: (data: TaskFormData) => Promise<void>
  onCancel: () => void
  isSubmitting?: boolean
  submitLabel?: string
}

function TaskForm({ initialData, onSubmit, onCancel, isSubmitting, submitLabel = 'Add Task' }: TaskFormProps) {
  const [form, setForm] = useState<TaskFormData>({ ...defaultTaskForm, ...initialData })
  const [errors, setErrors] = useState<Partial<Record<keyof TaskFormData, string>>>({})

  function update<K extends keyof TaskFormData>(key: K, value: TaskFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const newErrors: Partial<Record<keyof TaskFormData, string>> = {}
    if (!form.title.trim()) newErrors.title = 'Title is required'
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    await onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
      {/* Title */}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
          placeholder="Task title"
          autoFocus
          className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 ${
            errors.title ? 'border-red-300' : 'border-slate-200'
          }`}
        />
        {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
      </div>

      {/* Priority + Category row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Priority</label>
          <select
            value={form.priority}
            onChange={(e) => update('priority', e.target.value as PriorityValue)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 bg-white"
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
          <select
            value={form.category}
            onChange={(e) => update('category', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 bg-white"
          >
            <option value="">None</option>
            {TASK_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Due date */}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Due Date (optional)</label>
        <input
          type="date"
          value={form.dueDate}
          onChange={(e) => update('dueDate', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 bg-white"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Description (optional)</label>
        <textarea
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          rows={2}
          placeholder="Add details..."
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60 active:scale-[0.97] transition-all cursor-pointer flex items-center gap-1.5"
        >
          {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 active:scale-[0.97] transition-all cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

const STATUS_CYCLE: Record<StatusValue, StatusValue> = {
  TODO: 'IN_PROGRESS',
  IN_PROGRESS: 'DONE',
  DONE: 'TODO',
  BLOCKED: 'TODO',
}

interface TaskRowProps {
  task: EventTask
  onStatusToggle: (taskId: string, status: StatusValue) => Promise<void>
  onUpdate: (taskId: string, data: UpdateEventTaskInput) => Promise<void>
  onDelete: (taskId: string) => Promise<void>
  isTogglingStatus?: boolean
  isUpdating?: boolean
  isDeleting?: boolean
}

function TaskRow({ task, onStatusToggle, onUpdate, onDelete, isTogglingStatus, isUpdating, isDeleting }: TaskRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const priorityConfig = getPriorityConfig(task.priority)

  const isOverdue =
    task.status !== 'DONE' &&
    task.dueDate &&
    isPast(parseISO(task.dueDate))

  const editInitial: Partial<TaskFormData> = {
    title: task.title,
    description: task.description || '',
    priority: task.priority as PriorityValue,
    category: task.category || '',
    dueDate: task.dueDate ? format(parseISO(task.dueDate), 'yyyy-MM-dd') : '',
  }

  async function handleUpdate(data: TaskFormData) {
    await onUpdate(task.id, {
      title: data.title,
      description: data.description || undefined,
      priority: data.priority,
      category: data.category || undefined,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    })
    setIsEditing(false)
  }

  return (
    <motion.div variants={listItem} className="ui-glass-hover rounded-xl overflow-hidden">
      {isEditing ? (
        <div className="p-3">
          <TaskForm
            initialData={editInitial}
            onSubmit={handleUpdate}
            onCancel={() => setIsEditing(false)}
            isSubmitting={isUpdating}
            submitLabel="Save Changes"
          />
        </div>
      ) : (
        <div
          className="px-4 py-3 cursor-pointer"
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          <div className="flex items-center gap-3">
            {/* Status toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onStatusToggle(task.id, STATUS_CYCLE[task.status as StatusValue] ?? 'TODO')
              }}
              disabled={isTogglingStatus}
              className="flex-shrink-0 cursor-pointer disabled:opacity-60 hover:scale-110 transition-transform"
              aria-label={`Toggle status (currently ${task.status})`}
            >
              {isTogglingStatus ? (
                <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
              ) : (
                <StatusIcon status={task.status} />
              )}
            </button>

            {/* Title */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${task.status === 'DONE' ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                {task.title}
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {task.category && (
                  <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
                    {task.category}
                  </span>
                )}
                {task.dueDate && (
                  <span className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
                    {isOverdue ? 'Overdue · ' : ''}Due {format(parseISO(task.dueDate), 'MMM d')}
                  </span>
                )}
                {task.assignee && (
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <User className="w-3 h-3" />
                    {task.assignee.firstName
                      ? `${task.assignee.firstName} ${task.assignee.lastName || ''}`.trim()
                      : task.assignee.email}
                  </span>
                )}
              </div>
            </div>

            {/* Priority badge */}
            <span
              className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${priorityConfig.bg} ${priorityConfig.color}`}
            >
              {priorityConfig.label}
            </span>

            <div className="flex-shrink-0">
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </div>
          </div>

          {/* Expanded */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="pt-3 mt-3 border-t border-slate-100 space-y-2">
                  {task.description && (
                    <p className="text-sm text-slate-600">{task.description}</p>
                  )}
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(task.id)}
                      disabled={isDeleting}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {isDeleting ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                      Delete
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  )
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'DONE', label: 'Done' },
]

const PRIORITY_FILTERS = [
  { value: '', label: 'All' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'LOW', label: 'Low' },
]

// ─── Main Component ───────────────────────────────────────────────────────────

interface EventTasksTabProps {
  eventProjectId: string
}

export function EventTasksTab({ eventProjectId }: EventTasksTabProps) {
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: tasks, isLoading } = useEventTasks(eventProjectId)
  const createTask = useCreateEventTask(eventProjectId)
  const updateTask = useUpdateEventTask(eventProjectId)
  const deleteTask = useDeleteEventTask(eventProjectId)
  const { toast } = useToast()

  async function handleCreate(data: TaskFormData) {
    const payload: CreateEventTaskInput = {
      title: data.title,
      description: data.description || undefined,
      status: 'TODO',
      priority: data.priority,
      category: data.category || undefined,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    }
    try {
      await createTask.mutateAsync(payload)
      toast('Task added', 'success')
      setShowAddForm(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to add task', 'error')
    }
  }

  async function handleStatusToggle(taskId: string, status: StatusValue) {
    setTogglingId(taskId)
    try {
      await updateTask.mutateAsync({ taskId, data: { status } })
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update status', 'error')
    } finally {
      setTogglingId(null)
    }
  }

  async function handleUpdate(taskId: string, data: UpdateEventTaskInput) {
    setUpdatingId(taskId)
    try {
      await updateTask.mutateAsync({ taskId, data })
      toast('Task updated', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update task', 'error')
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleDelete(taskId: string) {
    setDeletingId(taskId)
    try {
      await deleteTask.mutateAsync(taskId)
      toast('Task removed', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to remove task', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading) return <TasksSkeleton />

  // Filter tasks client-side
  const filtered = (tasks || []).filter((t) => {
    if (statusFilter && t.status !== statusFilter) return false
    if (priorityFilter && t.priority !== priorityFilter) return false
    return true
  })

  const completedCount = (tasks || []).filter((t) => t.status === 'DONE').length
  const totalCount = (tasks || []).length
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Tasks</h3>
          {totalCount > 0 && (
            <p className="text-xs text-slate-500 mt-0.5">{completedCount}/{totalCount} complete</p>
          )}
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </button>
        )}
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="space-y-1">
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                background: 'linear-gradient(90deg, #3B82F6 0%, #6366F1 100%)',
              }}
            />
          </div>
        </div>
      )}

      {/* Add form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <TaskForm
              onSubmit={handleCreate}
              onCancel={() => setShowAddForm(false)}
              isSubmitting={createTask.isPending}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      {totalCount > 0 && (
        <div className="space-y-2">
          {/* Status filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  statusFilter === f.value
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {/* Priority filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500 font-medium">Priority:</span>
            {PRIORITY_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setPriorityFilter(f.value)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  priorityFilter === f.value
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Task list or empty state */}
      {!tasks || tasks.length === 0 ? (
        <TasksEmptyState onAdd={() => setShowAddForm(true)} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-400">
          No tasks match the current filters
        </div>
      ) : (
        <motion.div
          variants={staggerContainer(0.04)}
          initial="hidden"
          animate="visible"
          className="space-y-2"
        >
          {filtered.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onStatusToggle={handleStatusToggle}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              isTogglingStatus={togglingId === task.id}
              isUpdating={updatingId === task.id}
              isDeleting={deletingId === task.id}
            />
          ))}
        </motion.div>
      )}
    </div>
  )
}
