import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  Circle,
  Trash2,
  Plus,
  ListTodo,
  Calendar,
  ChevronDown,
  X,
} from 'lucide-react'

const STORAGE_KEY_PREFIX = 'lionheart-dashboard-todos'

function getStorageKey(userId) {
  return `${STORAGE_KEY_PREFIX}-${userId || 'anonymous'}`
}

function loadTodos(userId) {
  try {
    const key = getStorageKey(userId)
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveTodos(todos, userId) {
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(todos))
  } catch (_) {}
}

const PRIORITY_OPTIONS = [
  { id: 'low', label: 'Low', class: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/15' },
  { id: 'medium', label: 'Medium', class: 'text-amber-600 dark:text-amber-400 bg-amber-500/15' },
  { id: 'high', label: 'High', class: 'text-red-600 dark:text-red-400 bg-red-500/15' },
]

export default function DashboardTodoWidget({ currentUser }) {
  const userId = currentUser?.id ?? 'anonymous'
  const [todos, setTodos] = useState(() => loadTodos(userId))
  const [input, setInput] = useState('')
  const [filter, setFilter] = useState('all') // 'all' | 'completed'
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [showPriorityMenu, setShowPriorityMenu] = useState(null) // id or null
  const [dueDatePicker, setDueDatePicker] = useState(null) // id or null
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const persist = useCallback((next) => {
    setTodos(next)
    saveTodos(next, userId)
  }, [userId])

  useEffect(() => {
    saveTodos(todos, userId)
  }, [todos, userId])

  const addTodo = () => {
    const text = input.trim()
    if (!text) return
    const newTodo = {
      id: `todo-${Date.now()}`,
      text,
      completed: false,
      createdAt: new Date().toISOString(),
      dueDate: null,
      priority: 'medium',
    }
    persist([...todos, newTodo])
    setInput('')
  }

  const toggleComplete = (id) => {
    persist(
      todos.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    )
  }

  const deleteTodo = (id) => {
    persist(todos.filter((t) => t.id !== id))
    setEditingId(null)
    setShowPriorityMenu(null)
    setDueDatePicker(null)
  }

  const updateTodo = (id, updates) => {
    persist(
      todos.map((t) => (t.id === id ? { ...t, ...updates } : t))
    )
  }

  const startEdit = (todo) => {
    setEditingId(todo.id)
    setEditText(todo.text)
  }

  const submitEdit = () => {
    if (editingId == null) return
    const text = editText.trim()
    if (text) updateTodo(editingId, { text })
    setEditingId(null)
    setEditText('')
  }

  const clearCompleted = () => {
    persist(todos.filter((t) => !t.completed))
  }

  const setPriority = (id, priority) => {
    updateTodo(id, { priority })
    setShowPriorityMenu(null)
  }

  const setDueDate = (id, dueDate) => {
    updateTodo(id, { dueDate: dueDate || null })
    setDueDatePicker(null)
  }

  const filtered =
    filter === 'completed'
      ? todos.filter((t) => t.completed)
      : todos.filter((t) => !t.completed)

  const completedCount = todos.filter((t) => t.completed).length
  const activeCount = todos.filter((t) => !t.completed).length

  const formatDueDate = (dueDate) => {
    if (!dueDate) return null
    const d = new Date(dueDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dNorm = new Date(d)
    dNorm.setHours(0, 0, 0, 0)
    if (dNorm.getTime() === today.getTime()) return 'Today'
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (dNorm.getTime() === tomorrow.getTime()) return 'Tomorrow'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined })
  }

  const isOverdue = (dueDate) => {
    if (!dueDate) return false
    const d = new Date(dueDate)
    d.setHours(23, 59, 59, 999)
    return d < new Date()
  }

  const openDatePicker = (todoId, e) => {
    const isOpen = dueDatePicker === todoId
    setDueDatePicker(isOpen ? null : todoId)
    if (!isOpen && e?.currentTarget) {
      const r = e.currentTarget.getBoundingClientRect()
      setDropdownPosition({ top: r.bottom + 4, left: r.left })
    }
  }
  const openPriorityMenu = (todoId, e) => {
    const isOpen = showPriorityMenu === todoId
    setShowPriorityMenu(isOpen ? null : todoId)
    if (!isOpen && e?.currentTarget) {
      const r = e.currentTarget.getBoundingClientRect()
      setDropdownPosition({ top: r.bottom + 4, left: r.left })
    }
  }

  return (
    <aside className="w-[320px] lg:w-[360px] xl:w-[380px] flex flex-col rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl dark:shadow-black/20 overflow-hidden min-h-[400px] max-h-[calc(100vh-5rem)]">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <ListTodo className="w-5 h-5 text-blue-500 dark:text-blue-400" />
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            To-do
          </h2>
        </div>
      </div>

      {/* Add new */}
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <form
          onSubmit={(e) => { e.preventDefault(); addTodo() }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add a task…"
            className="flex-1 min-w-0 px-3 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="p-2.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:pointer-events-none transition-colors shrink-0"
            aria-label="Add task"
          >
            <Plus className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* Filters */}
      <div className="flex gap-1 p-2 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        {[
          { id: 'all', label: 'All', count: activeCount },
          { id: 'completed', label: 'Done', count: completedCount },
        ].map(({ id, label, count }) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === id
                ? 'bg-blue-500 text-white'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            {label}
            {count != null && (
              <span className="ml-1 opacity-80">({count})</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto min-h-0 p-3">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {filter === 'completed'
              ? 'No completed tasks.'
              : 'No tasks yet. Add one above!'}
          </div>
        ) : (
          <ul className="space-y-1">
            <AnimatePresence mode="popLayout">
              {filtered.map((todo) => (
                <motion.li
                  key={todo.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{
                    opacity: 0,
                    scale: 1.12,
                    filter: 'blur(6px)',
                    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
                  }}
                  className="group rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 origin-center"
                >
                  <div className="flex items-start gap-2 p-2.5">
                    <button
                      type="button"
                      onClick={() => toggleComplete(todo.id)}
                      className="mt-0.5 shrink-0 rounded-full p-0.5 text-zinc-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                      aria-label={todo.completed ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {todo.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      {editingId === todo.id ? (
                        <input
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onBlur={submitEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submitEdit()
                            if (e.key === 'Escape') {
                              setEditText(todo.text)
                              setEditingId(null)
                            }
                          }}
                          autoFocus
                          className="w-full px-2 py-1 rounded border border-blue-500 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(todo)}
                          className={`w-full text-left text-sm block py-0.5 break-words ${todo.completed ? 'line-through text-zinc-500 dark:text-zinc-400' : 'text-zinc-900 dark:text-zinc-100'} hover:underline focus:outline-none focus:ring-0`}
                        >
                          {todo.text}
                        </button>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {todo.dueDate && (
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${
                              isOverdue(todo.dueDate) && !todo.completed
                                ? 'text-red-600 dark:text-red-400 bg-red-500/15'
                                : 'text-zinc-500 dark:text-zinc-400 bg-zinc-200/50 dark:bg-zinc-700/50'
                            }`}
                          >
                            <Calendar className="w-3 h-3" />
                            {formatDueDate(todo.dueDate)}
                          </span>
                        )}
                        {todo.priority && todo.priority !== 'medium' && (
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${
                              PRIORITY_OPTIONS.find((p) => p.id === todo.priority)?.class ?? ''
                            }`}
                          >
                            {PRIORITY_OPTIONS.find((p) => p.id === todo.priority)?.label ?? todo.priority}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {/* Due date quick add */}
                      <button
                        type="button"
                        onClick={(e) => openDatePicker(todo.id, e)}
                        className="p-1.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 aria-pressed={dueDatePicker === todo.id}"
                        aria-label="Set due date"
                      >
                        <Calendar className="w-4 h-4" />
                      </button>
                      {/* Priority */}
                      <button
                        type="button"
                        onClick={(e) => openPriorityMenu(todo.id, e)}
                        className="p-1.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 aria-pressed={showPriorityMenu === todo.id}"
                        aria-label="Set priority"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTodo(todo.id)}
                        className="p-1.5 rounded text-zinc-400 hover:text-red-500 hover:bg-red-500/10"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {filter === 'completed' && completedCount > 0 && (
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
          <button
            type="button"
            onClick={clearCompleted}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <X className="w-4 h-4" />
            Clear completed ({completedCount})
          </button>
        </div>
      )}

      {/* Portals so dropdowns aren't clipped by card overflow */}
      {dueDatePicker && (() => {
        const todo = todos.find((t) => t.id === dueDatePicker)
        if (!todo) return null
        return createPortal(
          <>
            <div
              className="fixed inset-0 z-[100]"
              onClick={() => setDueDatePicker(null)}
              aria-hidden
            />
            <div
              className="fixed z-[101] p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-xl"
              style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
            >
              <input
                type="date"
                defaultValue={todo.dueDate ? todo.dueDate.slice(0, 10) : ''}
                onChange={(e) => setDueDate(todo.id, e.target.value ? `${e.target.value}T12:00:00` : null)}
                className="w-full px-2 py-1.5 rounded border border-zinc-300 dark:border-zinc-600 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 [color-scheme:light]"
              />
              <button
                type="button"
                onClick={() => { setDueDate(todo.id, null); setDueDatePicker(null) }}
                className="mt-2 w-full text-xs text-zinc-500 hover:text-red-500"
              >
                Clear date
              </button>
            </div>
          </>,
          document.body
        )
      })()}
      {showPriorityMenu && (() => {
        const todo = todos.find((t) => t.id === showPriorityMenu)
        if (!todo) return null
        return createPortal(
          <>
            <div
              className="fixed inset-0 z-[100]"
              onClick={() => setShowPriorityMenu(null)}
              aria-hidden
            />
            <div
              className="fixed z-[101] py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-xl min-w-[100px]"
              style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
            >
              {PRIORITY_OPTIONS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setPriority(todo.id, p.id); setShowPriorityMenu(null) }}
                  className={`w-full text-left px-3 py-1.5 text-xs font-medium ${p.class}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </>,
          document.body
        )
      })()}
    </aside>
  )
}
