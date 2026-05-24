'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'
import DynamicCategoryField from '@/components/shared/DynamicCategoryField'
import { FIELD_LIBRARY } from '@/lib/services/categoryFieldLibrary'
import type { CategoryFieldType } from '@prisma/client'
import {
  Sparkles,
  Calendar,
  Clock,
  Wand2,
  Loader2,
  CheckCircle2,
  AlertTriangle as AlertTriangleIcon,
  Zap,
  Droplets,
  Wind,
  Hammer,
  SprayCan,
  Trees,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'

const CATEGORIES: Array<{ value: string; label: string; icon: LucideIcon; color: string; selectedColor: string }> = [
  { value: 'ELECTRICAL', label: 'Electrical', icon: Zap, color: 'text-amber-500 bg-amber-50', selectedColor: 'text-amber-700 bg-amber-100 border-amber-400 ring-2 ring-amber-200' },
  { value: 'PLUMBING', label: 'Plumbing', icon: Droplets, color: 'text-blue-500 bg-blue-50', selectedColor: 'text-blue-700 bg-blue-100 border-blue-400 ring-2 ring-blue-200' },
  { value: 'HVAC', label: 'HVAC', icon: Wind, color: 'text-teal-500 bg-teal-50', selectedColor: 'text-teal-700 bg-teal-100 border-teal-400 ring-2 ring-teal-200' },
  { value: 'STRUCTURAL', label: 'Structural', icon: Hammer, color: 'text-orange-500 bg-orange-50', selectedColor: 'text-orange-700 bg-orange-100 border-orange-400 ring-2 ring-orange-200' },
  { value: 'CUSTODIAL_BIOHAZARD', label: 'Custodial', icon: SprayCan, color: 'text-purple-500 bg-purple-50', selectedColor: 'text-purple-700 bg-purple-100 border-purple-400 ring-2 ring-purple-200' },
  { value: 'GROUNDS', label: 'Grounds', icon: Trees, color: 'text-green-500 bg-green-50', selectedColor: 'text-green-700 bg-green-100 border-green-400 ring-2 ring-green-200' },
  { value: 'OTHER', label: 'Other', icon: HelpCircle, color: 'text-slate-500 bg-slate-50', selectedColor: 'text-slate-700 bg-slate-100 border-slate-400 ring-2 ring-slate-200' },
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
  customFields: Record<string, unknown>
  onCustomFieldsChange: (fields: Record<string, unknown>) => void
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
  customFields,
  onCustomFieldsChange,
}: StepDetailsProps) {
  // Fetch dynamic fields for the selected category
  interface FieldConfigRecord {
    fieldType: CategoryFieldType
    required: boolean
    sortOrder: number
  }
  const { data: enabledFieldConfigs } = useQuery({
    queryKey: ['category-fields', 'MAINTENANCE', category],
    queryFn: () =>
      fetchApi<FieldConfigRecord[]>(
        `/api/settings/ticket-routing/fields?module=MAINTENANCE&categoryKey=${category}`
      ),
    enabled: !!category,
  })

  // Auto-escalate priority when safety hazard is checked
  useEffect(() => {
    if (customFields.SAFETY_HAZARD === true && priority !== 'URGENT') {
      onPriorityChange('URGENT')
    }
  }, [customFields.SAFETY_HAZARD, priority, onPriorityChange])

  const [quickDescribe, setQuickDescribe] = useState('')
  const [classifying, setClassifying] = useState(false)
  const [classifyResult, setClassifyResult] = useState<{
    confidence: string
    reasoning: string
  } | null>(null)

  const handleClassify = async () => {
    if (quickDescribe.trim().length < 5) return
    setClassifying(true)
    setClassifyResult(null)
    try {
      const res = await fetchApi<{
        category: string
        suggestedTitle: string
        suggestedPriority: string
        confidence: string
        reasoning: string
        extractedLocation: string | null
      }>('/api/ai/ticket-intake/classify', {
        method: 'POST',
        body: JSON.stringify({ description: quickDescribe, module: 'MAINTENANCE' }),
      })
      if (res) {
        onTitleChange(res.suggestedTitle)
        onCategoryChange(res.category)
        onPriorityChange(res.suggestedPriority)
        onDescriptionChange(quickDescribe)
        setClassifyResult({ confidence: res.confidence, reasoning: res.reasoning })
      }
    } catch {
      // Silently fail — user can still fill manually
    } finally {
      setClassifying(false)
    }
  }

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

      {/* Quick Describe — AI Classify */}
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Wand2 className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-medium text-indigo-900">Quick Describe</span>
          <span className="text-xs text-indigo-500">AI-powered</span>
        </div>
        <Textarea
          value={quickDescribe}
          onChange={(e) => setQuickDescribe(e.target.value)}
          placeholder="Describe the issue in your own words... e.g. 'The projector in Room 203 won't turn on, I have a class in 20 minutes'"
          rows={2}
          className="w-full text-sm resize-none"
        />
        <div className="flex items-center gap-3 mt-2">
          <button
            type="button"
            onClick={handleClassify}
            disabled={classifying || quickDescribe.trim().length < 5}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50 cursor-pointer"
          >
            {classifying ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Classifying...
              </>
            ) : (
              <>
                <Wand2 className="w-3.5 h-3.5" />
                Let AI Classify
              </>
            )}
          </button>
          {classifyResult && (
            <div className="flex items-center gap-1.5 text-xs">
              {classifyResult.confidence === 'HIGH' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              ) : classifyResult.confidence === 'MEDIUM' ? (
                <AlertTriangleIcon className="w-3.5 h-3.5 text-amber-500" />
              ) : (
                <AlertTriangleIcon className="w-3.5 h-3.5 text-red-500" />
              )}
              <span className={
                classifyResult.confidence === 'HIGH' ? 'text-green-700' :
                classifyResult.confidence === 'MEDIUM' ? 'text-amber-700' : 'text-red-700'
              }>
                {classifyResult.confidence} confidence
              </span>
              <span className="text-slate-400">— {classifyResult.reasoning}</span>
            </div>
          )}
        </div>
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
        <Input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value.slice(0, 200))}
          placeholder="e.g. Leaking faucet in Room 201"
          className="w-full text-sm"
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon
            const isSelected = category === cat.value
            const isAiSuggested = aiSuggestedCategory === cat.value && isSelected
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => onCategoryChange(cat.value)}
                className={`
                  relative flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border transition-all cursor-pointer
                  ${isSelected ? cat.selectedColor : `border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50`}
                `}
              >
                {isAiSuggested && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                    <Sparkles className="w-3 h-3 text-white" />
                  </span>
                )}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? '' : cat.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`text-xs font-medium ${isSelected ? '' : 'text-slate-700'}`}>{cat.label}</span>
              </button>
            )
          })}
        </div>
        {aiSuggestedCategory && aiSuggestedCategory !== category && (
          <button
            type="button"
            onClick={() => onCategoryChange(aiSuggestedCategory)}
            className="mt-2 flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 transition-colors cursor-pointer"
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

      {/* Dynamic category-scoped fields */}
      {enabledFieldConfigs && enabledFieldConfigs.length > 0 && (
        <div className="space-y-4 pt-1">
          {enabledFieldConfigs
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((fc) => {
              const fieldDef = FIELD_LIBRARY[fc.fieldType]
              if (!fieldDef) return null
              return (
                <DynamicCategoryField
                  key={fc.fieldType}
                  field={{ ...fieldDef, required: fc.required }}
                  value={customFields[fc.fieldType] ?? null}
                  onChange={(val) =>
                    onCustomFieldsChange({ ...customFields, [fc.fieldType]: val })
                  }
                  formValues={{ priority, category, ...customFields }}
                  module="MAINTENANCE"
                />
              )
            })}
        </div>
      )}

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
        <Textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value.slice(0, 2000))}
          placeholder="Provide additional details about the issue..."
          rows={3}
          className="w-full text-sm resize-none"
        />
      </div>

      {/* Availability Note */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Access Note <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <Input
          type="text"
          value={availabilityNote}
          onChange={(e) => onAvailabilityNoteChange(e.target.value)}
          placeholder="e.g. Room available after 3pm, contact front office for key"
          className="w-full text-sm"
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
                  <Input
                    type="date"
                    value={scheduledDate}
                    min={minDateStr}
                    onChange={(e) => onScheduledDateChange(e.target.value)}
                    className="flex-1 text-sm cursor-pointer"
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
