'use client'

import { useState, useEffect } from 'react'
import { Sparkles, Plus, X, Loader2, CalendarDays, MapPin, Users, Clock } from 'lucide-react'
import type { AIEventSuggestion, AIBudgetLineItem } from '@/lib/types/event-ai'
import type { ScheduleBlockTemplate, TaskTemplate } from '@/lib/types/event-template'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AIEventPreviewProps {
  suggestion: AIEventSuggestion | null
  onEdit: (field: string, value: unknown) => void
  onConfirm: (data: AIEventSuggestion) => void
  isCreating: boolean
}

// ─── Block type options ────────────────────────────────────────────────────────

const BLOCK_TYPES = ['SESSION', 'MEAL', 'TRAVEL', 'ACTIVITY', 'BREAK', 'CEREMONY', 'FREE_TIME']
const TASK_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL']

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-20 text-center px-6">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(99,102,241,0.1) 50%, rgba(139,92,246,0.1) 100%)',
        }}
      >
        <Sparkles className="w-7 h-7 text-indigo-500" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-2">
        Describe your event to Leo
      </h3>
      <p className="text-sm text-slate-500 max-w-xs">
        Once you describe your event, Leo will fill in the details here. You can edit everything
        before creating.
      </p>
    </div>
  )
}

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="ui-glass rounded-2xl p-5">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">{title}</h3>
      {children}
    </div>
  )
}

// ─── Field input helpers ──────────────────────────────────────────────────────

function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 transition-colors"
      />
    </div>
  )
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 transition-colors"
      />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AIEventPreview({ suggestion, onEdit, onConfirm, isCreating }: AIEventPreviewProps) {
  // Local editable state — initialized from suggestion, updated on refinement
  const [local, setLocal] = useState<AIEventSuggestion | null>(null)

  // Sync local state whenever suggestion changes (first generation or refinement)
  useEffect(() => {
    if (suggestion) {
      setLocal(suggestion)
    }
  }, [suggestion])

  if (!local) {
    return <EmptyState />
  }

  // ─── Field mutators (immutable pattern) ─────────────────────────────────────

  function updateField<K extends keyof AIEventSuggestion>(key: K, value: AIEventSuggestion[K]) {
    setLocal((prev) => {
      if (!prev) return prev
      const next = { ...prev, [key]: value }
      onEdit(key, value)
      return next
    })
  }

  // ─── Schedule block helpers ──────────────────────────────────────────────────

  function updateScheduleBlock(index: number, field: keyof ScheduleBlockTemplate, value: string | number) {
    setLocal((prev) => {
      if (!prev) return prev
      const updated = prev.scheduleBlocks.map((block, i) =>
        i === index ? { ...block, [field]: value } : block,
      )
      onEdit('scheduleBlocks', updated)
      return { ...prev, scheduleBlocks: updated }
    })
  }

  function addScheduleBlock() {
    const newBlock: ScheduleBlockTemplate = {
      dayOffset: 0,
      startTime: '09:00',
      endTime: '10:00',
      title: 'New Block',
      type: 'SESSION',
    }
    setLocal((prev) => {
      if (!prev) return prev
      const updated = [...prev.scheduleBlocks, newBlock]
      onEdit('scheduleBlocks', updated)
      return { ...prev, scheduleBlocks: updated }
    })
  }

  function removeScheduleBlock(index: number) {
    setLocal((prev) => {
      if (!prev) return prev
      const updated = prev.scheduleBlocks.filter((_, i) => i !== index)
      onEdit('scheduleBlocks', updated)
      return { ...prev, scheduleBlocks: updated }
    })
  }

  // ─── Document helpers ────────────────────────────────────────────────────────

  const [newDoc, setNewDoc] = useState('')

  function toggleDoc(doc: string) {
    setLocal((prev) => {
      if (!prev) return prev
      const exists = prev.suggestedDocs.includes(doc)
      const updated = exists
        ? prev.suggestedDocs.filter((d) => d !== doc)
        : [...prev.suggestedDocs, doc]
      onEdit('suggestedDocs', updated)
      return { ...prev, suggestedDocs: updated }
    })
  }

  function addDoc() {
    const trimmed = newDoc.trim()
    if (!trimmed) return
    setLocal((prev) => {
      if (!prev) return prev
      const updated = [...prev.suggestedDocs, trimmed]
      onEdit('suggestedDocs', updated)
      return { ...prev, suggestedDocs: updated }
    })
    setNewDoc('')
  }

  // ─── Task helpers ────────────────────────────────────────────────────────────

  const [includedTasks, setIncludedTasks] = useState<Set<number>>(
    new Set(local.suggestedTasks.map((_, i) => i)),
  )
  const [newTaskTitle, setNewTaskTitle] = useState('')

  function toggleTask(index: number) {
    setIncludedTasks((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  function updateTask(index: number, field: keyof TaskTemplate, value: string) {
    setLocal((prev) => {
      if (!prev) return prev
      const updated = prev.suggestedTasks.map((t, i) =>
        i === index ? { ...t, [field]: value } : t,
      )
      onEdit('suggestedTasks', updated)
      return { ...prev, suggestedTasks: updated }
    })
  }

  function addTask() {
    const trimmed = newTaskTitle.trim()
    if (!trimmed) return
    const newTask: TaskTemplate = { title: trimmed, priority: 'NORMAL' }
    setLocal((prev) => {
      if (!prev) return prev
      const updated = [...prev.suggestedTasks, newTask]
      const newIndex = updated.length - 1
      setIncludedTasks((prevSet) => new Set([...prevSet, newIndex]))
      onEdit('suggestedTasks', updated)
      return { ...prev, suggestedTasks: updated }
    })
    setNewTaskTitle('')
  }

  // ─── Budget helpers ──────────────────────────────────────────────────────────

  function updateBudgetItem(index: number, field: keyof AIBudgetLineItem, value: string | number) {
    setLocal((prev) => {
      if (!prev) return prev
      const updated = prev.budgetEstimate.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      )
      onEdit('budgetEstimate', updated)
      return { ...prev, budgetEstimate: updated }
    })
  }

  function addBudgetItem() {
    const newItem: AIBudgetLineItem = {
      category: 'New Category',
      estimatedMin: 0,
      estimatedMax: 0,
    }
    setLocal((prev) => {
      if (!prev) return prev
      const updated = [...prev.budgetEstimate, newItem]
      onEdit('budgetEstimate', updated)
      return { ...prev, budgetEstimate: updated }
    })
  }

  function removeBudgetItem(index: number) {
    setLocal((prev) => {
      if (!prev) return prev
      const updated = prev.budgetEstimate.filter((_, i) => i !== index)
      onEdit('budgetEstimate', updated)
      return { ...prev, budgetEstimate: updated }
    })
  }

  const totalMin = local.budgetEstimate.reduce((sum, b) => sum + (b.estimatedMin || 0), 0)
  const totalMax = local.budgetEstimate.reduce((sum, b) => sum + (b.estimatedMax || 0), 0)

  // ─── Build confirmed data (only included tasks) ──────────────────────────────

  function handleConfirm() {
    if (!local) return
    const filteredTasks = local.suggestedTasks.filter((_, i) => includedTasks.has(i))
    onConfirm({ ...local, suggestedTasks: filteredTasks })
  }

  const PRIORITY_COLORS: Record<string, string> = {
    LOW: 'bg-slate-100 text-slate-600',
    NORMAL: 'bg-blue-50 text-blue-700',
    HIGH: 'bg-amber-50 text-amber-700',
    CRITICAL: 'bg-red-50 text-red-700',
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-5 py-4 border-b border-slate-200/50 flex items-center gap-2 flex-shrink-0">
        <Sparkles className="w-4 h-4 text-indigo-500" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-slate-900">Event Preview</h2>
        <span className="ml-auto text-xs text-slate-400">Edit anything before creating</span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

        {/* 1. Event Details */}
        <SectionCard title="Event Details">
          <div className="space-y-3">
            <TextInput
              label="Title"
              value={local.title}
              onChange={(v) => updateField('title', v)}
              placeholder="Event title"
            />
            <TextArea
              label="Description"
              value={local.description}
              onChange={(v) => updateField('description', v)}
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  <CalendarDays className="inline w-3 h-3 mr-1" />Start Date
                </label>
                <input
                  type="date"
                  value={local.startsAt}
                  onChange={(e) => updateField('startsAt', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400/40 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  <CalendarDays className="inline w-3 h-3 mr-1" />End Date
                </label>
                <input
                  type="date"
                  value={local.endsAt}
                  onChange={(e) => updateField('endsAt', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400/40 transition-colors"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  <MapPin className="inline w-3 h-3 mr-1" />Location
                </label>
                <input
                  type="text"
                  value={local.locationText}
                  onChange={(e) => updateField('locationText', e.target.value)}
                  placeholder="Event location"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400/40 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  <Users className="inline w-3 h-3 mr-1" />Expected Attendance
                </label>
                <input
                  type="number"
                  min={0}
                  value={local.expectedAttendance}
                  onChange={(e) => updateField('expectedAttendance', parseInt(e.target.value, 10) || 0)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400/40 transition-colors"
                />
              </div>
            </div>
          </div>
        </SectionCard>

        {/* 2. Suggested Schedule */}
        <SectionCard title="Suggested Schedule">
          {local.scheduleBlocks.length === 0 ? (
            <p className="text-xs text-slate-400 mb-3">No schedule blocks yet.</p>
          ) : (
            <div className="overflow-x-auto mb-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100">
                    <th className="text-left pb-2 pr-2 font-medium w-14">Day</th>
                    <th className="text-left pb-2 pr-2 font-medium w-20">
                      <Clock className="inline w-3 h-3 mr-0.5" />Time
                    </th>
                    <th className="text-left pb-2 pr-2 font-medium">Title</th>
                    <th className="text-left pb-2 pr-2 font-medium w-28">Type</th>
                    <th className="pb-2 w-6" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {local.scheduleBlocks.map((block, i) => (
                    <tr key={i} className="group">
                      <td className="py-1.5 pr-2">
                        <input
                          type="number"
                          min={0}
                          value={block.dayOffset}
                          onChange={(e) =>
                            updateScheduleBlock(i, 'dayOffset', parseInt(e.target.value, 10) || 0)
                          }
                          className="w-12 rounded-lg border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <div className="flex items-center gap-0.5">
                          <input
                            type="time"
                            value={block.startTime}
                            onChange={(e) => updateScheduleBlock(i, 'startTime', e.target.value)}
                            className="w-20 rounded-lg border border-slate-200 px-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
                          />
                        </div>
                      </td>
                      <td className="py-1.5 pr-2">
                        <input
                          type="text"
                          value={block.title}
                          onChange={(e) => updateScheduleBlock(i, 'title', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <select
                          value={block.type}
                          onChange={(e) => updateScheduleBlock(i, 'type', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white cursor-pointer"
                        >
                          {BLOCK_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t.charAt(0) + t.slice(1).toLowerCase().replace('_', ' ')}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1.5">
                        <button
                          onClick={() => removeScheduleBlock(i)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all cursor-pointer"
                          aria-label="Remove block"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button
            onClick={addScheduleBlock}
            className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-800 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Block
          </button>
        </SectionCard>

        {/* 3. Suggested Documents */}
        <SectionCard title="Suggested Documents">
          <div className="space-y-1.5 mb-3">
            {local.suggestedDocs.length === 0 && (
              <p className="text-xs text-slate-400">No documents suggested.</p>
            )}
            {local.suggestedDocs.map((doc) => (
              <label key={doc} className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={true}
                  onChange={() => toggleDoc(doc)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-400 cursor-pointer"
                />
                <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">
                  {doc}
                </span>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newDoc}
              onChange={(e) => setNewDoc(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addDoc()
              }}
              placeholder="Add document type..."
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400/40 transition-colors"
            />
            <button
              onClick={addDoc}
              disabled={!newDoc.trim()}
              className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 disabled:opacity-40 cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
        </SectionCard>

        {/* 4. Suggested Tasks */}
        <SectionCard title="Suggested Tasks">
          <div className="space-y-1.5 mb-3">
            {local.suggestedTasks.length === 0 && (
              <p className="text-xs text-slate-400">No tasks suggested.</p>
            )}
            {local.suggestedTasks.map((task, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={includedTasks.has(i)}
                  onChange={() => toggleTask(i)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-400 cursor-pointer flex-shrink-0"
                />
                <input
                  type="text"
                  value={task.title}
                  onChange={(e) => updateTask(i, 'title', e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-300 min-w-0"
                />
                <select
                  value={task.priority ?? 'NORMAL'}
                  onChange={(e) => updateTask(i, 'priority', e.target.value)}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium border-0 focus:outline-none cursor-pointer flex-shrink-0 ${
                    PRIORITY_COLORS[task.priority ?? 'NORMAL'] ?? PRIORITY_COLORS.NORMAL
                  }`}
                >
                  {TASK_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p.charAt(0) + p.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addTask()
              }}
              placeholder="Add task..."
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400/40 transition-colors"
            />
            <button
              onClick={addTask}
              disabled={!newTaskTitle.trim()}
              className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 disabled:opacity-40 cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
        </SectionCard>

        {/* 5. Budget Estimate */}
        <SectionCard title="Budget Estimate">
          {local.budgetEstimate.length === 0 ? (
            <p className="text-xs text-slate-400 mb-3">No budget categories yet.</p>
          ) : (
            <div className="overflow-x-auto mb-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100">
                    <th className="text-left pb-2 pr-2 font-medium">Category</th>
                    <th className="text-right pb-2 pr-2 font-medium w-24">Min ($)</th>
                    <th className="text-right pb-2 pr-2 font-medium w-24">Max ($)</th>
                    <th className="pb-2 w-6" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {local.budgetEstimate.map((item, i) => (
                    <tr key={i} className="group">
                      <td className="py-1.5 pr-2">
                        <input
                          type="text"
                          value={item.category}
                          onChange={(e) => updateBudgetItem(i, 'category', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input
                          type="number"
                          min={0}
                          value={item.estimatedMin}
                          onChange={(e) =>
                            updateBudgetItem(i, 'estimatedMin', parseFloat(e.target.value) || 0)
                          }
                          className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-300"
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input
                          type="number"
                          min={0}
                          value={item.estimatedMax}
                          onChange={(e) =>
                            updateBudgetItem(i, 'estimatedMax', parseFloat(e.target.value) || 0)
                          }
                          className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-300"
                        />
                      </td>
                      <td className="py-1.5">
                        <button
                          onClick={() => removeBudgetItem(i)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all cursor-pointer"
                          aria-label="Remove budget item"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 font-semibold text-slate-700">
                    <td className="pt-2 text-xs">Total Estimate</td>
                    <td className="pt-2 pr-2 text-right text-xs">${totalMin.toLocaleString()}</td>
                    <td className="pt-2 pr-2 text-right text-xs">${totalMax.toLocaleString()}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <button
            onClick={addBudgetItem}
            className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-800 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Category
          </button>
        </SectionCard>
      </div>

      {/* Create Event button — sticky footer */}
      <div className="px-5 py-4 border-t border-slate-200/50 flex-shrink-0">
        <button
          onClick={handleConfirm}
          disabled={isCreating}
          className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-full text-sm font-semibold text-white cursor-pointer active:scale-[0.97] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(90deg, #3B82F6 0%, #6366F1 100%)',
          }}
        >
          {isCreating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating Event...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Create Event
            </>
          )}
        </button>
      </div>
    </div>
  )
}
