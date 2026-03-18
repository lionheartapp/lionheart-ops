'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Calendar, Clock } from 'lucide-react'

const CATEGORIES = [
  { value: 'ELECTRICAL', label: 'Electrical' },
  { value: 'PLUMBING', label: 'Plumbing' },
  { value: 'HVAC', label: 'HVAC' },
  { value: 'STRUCTURAL', label: 'Structural' },
  { value: 'CUSTODIAL_BIOHAZARD', label: 'Custodial / Biohazard' },
  { value: 'IT_AV', label: 'IT / A/V' },
  { value: 'GROUNDS', label: 'Grounds' },
  { value: 'OTHER', label: 'Other' },
]

const PRIORITIES = [
  {
    value: 'LOW',
    label: 'Low',
    description: 'Not urgent, can wait',
    colors: 'bg-slate-50 border-slate-200 text-slate-700',
    selected: 'bg-slate-100 border-slate-400 text-slate-900 ring-2 ring-slate-300',
  },
  {
    value: 'MEDIUM',
    label: 'Medium',
    description: 'Should be addressed soon',
    colors: 'bg-blue-50 border-blue-200 text-blue-700',
    selected: 'bg-blue-100 border-blue-400 text-blue-900 ring-2 ring-blue-300',
  },
  {
    value: 'HIGH',
    label: 'High',
    description: 'Affects daily operations',
    colors: 'bg-orange-50 border-orange-200 text-orange-700',
    selected: 'bg-orange-100 border-orange-400 text-orange-900 ring-2 ring-orange-300',
  },
  {
    value: 'URGENT',
    label: 'Urgent',
    description: 'Safety hazard or emergency',
    colors: 'bg-red-50 border-red-200 text-red-700',
    selected: 'bg-red-100 border-red-400 text-red-900 ring-2 ring-red-300',
  },
]

interface StepDetailsProps {
  title: string
  description: string
  category: string
  priority: string
  availabilityNote: string
  scheduledDate: string
  aiSuggestedCategory: string | null
  onTitleChange: (v: string) => void
  onDescriptionChange: (v: string) => void
  onCategoryChange: (v: string) => void
  onPriorityChange: (v: string) => void
  onAvailabilityNoteChange: (v: string) => void
  onScheduledDateChange: (v: string) => void
}

export default function StepDetails({
  title,
  description,
  category,
  priority,
  availabilityNote,
  scheduledDate,
  aiSuggestedCategory,
  onTitleChange,
  onDescriptionChange,
  onCategoryChange,
  onPriorityChange,
  onAvailabilityNoteChange,
  onScheduledDateChange,
}: StepDetailsProps) {
  const [scheduleEnabled, setScheduleEnabled] = useState(!!scheduledDate)
  const titleRemaining = 200 - title.length
  const descRemaining = 2000 - description.length

  const today = new Date()
  const minDate = new Date(today)
  minDate.setDate(today.getDate() + 1)
  const minDateStr = minDate.toISOString().split('T')[0]

  const handleScheduleToggle = (enabled: boolean) => {
    setScheduleEnabled(enabled)
    if (!enabled) onScheduledDateChange('')
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-slate-900 mb-1">Describe the Issue</h3>
        <p className="text-sm text-slate-500">Tell the maintenance team what needs attention</p>
      </div>

      {/* Title */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-slate-700">
            Issue Title <span className="text-red-500">*</span>
          </label>
          <span className={`text-xs ${titleRemaining < 20 ? 'text-red-500' : 'text-slate-400'}`}>
            {titleRemaining} left
          </span>
        </div>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value.slice(0, 200))}
          placeholder="e.g. Leaking faucet in Room 201"
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus:border-transparent transition-shadow"
        />
      </div>

      {/* Category */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <label className="block text-sm font-medium text-slate-700">
            Category <span className="text-red-500">*</span>
          </label>
          {aiSuggestedCategory && aiSuggestedCategory === category && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-md font-medium border border-purple-100">
              <Sparkles className="w-3 h-3" />
              AI suggested
            </span>
          )}
        </div>
        <select
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus:border-transparent transition-shadow cursor-pointer appearance-none"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center' }}
        >
          <option value="">Select a category...</option>
          {CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
        {aiSuggestedCategory && aiSuggestedCategory !== category && (
          <button
            type="button"
            onClick={() => onCategoryChange(aiSuggestedCategory)}
            className="mt-1.5 flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3 h-3" />
            AI suggests: {CATEGORIES.find(c => c.value === aiSuggestedCategory)?.label || aiSuggestedCategory} — Apply
          </button>
        )}
      </div>

      {/* Priority */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Priority</label>
        <div className="grid grid-cols-2 gap-2">
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => onPriorityChange(p.value)}
              className={`
                px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer
                ${priority === p.value ? p.selected : p.colors + ' hover:opacity-80'}
              `}
            >
              <div className="font-medium text-sm">{p.label}</div>
              <div className="text-xs opacity-70 mt-0.5">{p.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-slate-700">
            Description <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <span className={`text-xs ${descRemaining < 100 ? 'text-red-500' : 'text-slate-400'}`}>
            {descRemaining} left
          </span>
        </div>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value.slice(0, 2000))}
          placeholder="Provide additional details about the issue..."
          rows={3}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus:border-transparent transition-shadow resize-none"
        />
      </div>

      {/* Availability Note */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Access Note <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={availabilityNote}
          onChange={(e) => onAvailabilityNoteChange(e.target.value)}
          placeholder="e.g. Room available after 3pm, contact front office for key"
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus:border-transparent transition-shadow"
        />
      </div>

      {/* Schedule for later */}
      <div className="ui-glass rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">Schedule for later</p>
              <p className="text-xs text-slate-500">Set a future start date</p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={scheduleEnabled}
            onClick={() => handleScheduleToggle(!scheduleEnabled)}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1
              ${scheduleEnabled ? 'bg-primary-500' : 'bg-slate-200'}
            `}
          >
            <span
              className={`
                inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform
                ${scheduleEnabled ? 'translate-x-6' : 'translate-x-1'}
              `}
            />
          </button>
        </div>

        <AnimatePresence>
          {scheduleEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <input
                    type="date"
                    value={scheduledDate}
                    min={minDateStr}
                    onChange={(e) => onScheduledDateChange(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus:border-transparent transition-shadow cursor-pointer"
                  />
                </div>
                {scheduledDate && (
                  <p className="mt-1.5 text-xs text-blue-600 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Ticket will enter &ldquo;Scheduled&rdquo; status and activate on this date
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
