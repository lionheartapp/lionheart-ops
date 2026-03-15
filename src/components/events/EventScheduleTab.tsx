'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import {
  CalendarDays,
  Plus,
  MapPin,
  User,
  Pencil,
  Trash2,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
} from 'lucide-react'
import { staggerContainer, listItem, fadeInUp } from '@/lib/animations'
import {
  useScheduleBlocks,
  useCreateScheduleBlock,
  useUpdateScheduleBlock,
  useDeleteScheduleBlock,
} from '@/lib/hooks/useEventSchedule'
import { type EventScheduleBlock } from '@/lib/hooks/useEventProject'
import { useToast } from '@/components/Toast'
import type { CreateScheduleBlockInput, UpdateScheduleBlockInput } from '@/lib/types/event-project'

// ─── Block type config ────────────────────────────────────────────────────────

const BLOCK_TYPES: Array<{
  value: 'SESSION' | 'ACTIVITY' | 'MEAL' | 'FREE_TIME' | 'TRAVEL' | 'SETUP'
  label: string
  color: string
  bg: string
}> = [
  { value: 'SESSION', label: 'Session', color: 'text-blue-700', bg: 'bg-blue-100' },
  { value: 'ACTIVITY', label: 'Activity', color: 'text-green-700', bg: 'bg-green-100' },
  { value: 'MEAL', label: 'Meal', color: 'text-amber-700', bg: 'bg-amber-100' },
  { value: 'FREE_TIME', label: 'Free Time', color: 'text-gray-600', bg: 'bg-gray-100' },
  { value: 'TRAVEL', label: 'Travel', color: 'text-purple-700', bg: 'bg-purple-100' },
  { value: 'SETUP', label: 'Setup', color: 'text-orange-700', bg: 'bg-orange-100' },
]

function getBlockTypeConfig(type: string) {
  return BLOCK_TYPES.find((t) => t.value === type) ?? BLOCK_TYPES[0]
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function ScheduleSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-gray-100 rounded-xl h-20" />
      ))}
    </div>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function ScheduleEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="text-center py-12">
      <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
        <CalendarDays className="w-7 h-7 text-indigo-500" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-2">No schedule blocks yet</h3>
      <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
        Build your event schedule by adding time blocks for sessions, activities, meals, and more.
      </p>
      <button
        onClick={onAdd}
        className="px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all cursor-pointer"
      >
        Add First Block
      </button>
    </motion.div>
  )
}

// ─── Block Form ───────────────────────────────────────────────────────────────

interface BlockFormData {
  type: 'SESSION' | 'ACTIVITY' | 'MEAL' | 'FREE_TIME' | 'TRAVEL' | 'SETUP'
  title: string
  description: string
  date: string
  startTime: string
  endTime: string
  locationText: string
}

const defaultForm: BlockFormData = {
  type: 'SESSION',
  title: '',
  description: '',
  date: '',
  startTime: '',
  endTime: '',
  locationText: '',
}

interface BlockFormProps {
  initialData?: BlockFormData
  onSubmit: (data: BlockFormData) => Promise<void>
  onCancel: () => void
  isSubmitting?: boolean
  submitLabel?: string
  defaultDate?: string
}

function BlockForm({ initialData, onSubmit, onCancel, isSubmitting, submitLabel = 'Add Block', defaultDate }: BlockFormProps) {
  const [form, setForm] = useState<BlockFormData>({
    ...defaultForm,
    date: defaultDate || '',
    ...initialData,
  })
  const [errors, setErrors] = useState<Partial<Record<keyof BlockFormData, string>>>({})

  function update<K extends keyof BlockFormData>(key: K, value: BlockFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const newErrors: Partial<Record<keyof BlockFormData, string>> = {}
    if (!form.title.trim()) newErrors.title = 'Title is required'
    if (!form.date) newErrors.date = 'Date is required'
    if (!form.startTime) newErrors.startTime = 'Start time is required'
    if (!form.endTime) newErrors.endTime = 'End time is required'
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    await onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
      {/* Type */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Block Type</label>
        <div className="flex flex-wrap gap-2">
          {BLOCK_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => update('type', t.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                form.type === t.value
                  ? `${t.bg} ${t.color} ring-2 ring-indigo-300`
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
          placeholder="Block title"
          className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 ${
            errors.title ? 'border-red-300' : 'border-gray-200'
          }`}
        />
        {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
      </div>

      {/* Date + Times row */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => update('date', e.target.value)}
            className={`w-full px-2 py-2 text-sm border rounded-lg focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 ${
              errors.date ? 'border-red-300' : 'border-gray-200'
            }`}
          />
          {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Start <span className="text-red-500">*</span>
          </label>
          <input
            type="time"
            value={form.startTime}
            onChange={(e) => update('startTime', e.target.value)}
            className={`w-full px-2 py-2 text-sm border rounded-lg focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 ${
              errors.startTime ? 'border-red-300' : 'border-gray-200'
            }`}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            End <span className="text-red-500">*</span>
          </label>
          <input
            type="time"
            value={form.endTime}
            onChange={(e) => update('endTime', e.target.value)}
            className={`w-full px-2 py-2 text-sm border rounded-lg focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 ${
              errors.endTime ? 'border-red-300' : 'border-gray-200'
            }`}
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Description (optional)</label>
        <textarea
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          rows={2}
          placeholder="Add details..."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 resize-none"
        />
      </div>

      {/* Location */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Location (optional)</label>
        <input
          type="text"
          value={form.locationText}
          onChange={(e) => update('locationText', e.target.value)}
          placeholder="e.g. Main Hall, Room 204"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-60 active:scale-[0.97] transition-all cursor-pointer flex items-center gap-1.5"
        >
          {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-full bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 active:scale-[0.97] transition-all cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── Block Card ───────────────────────────────────────────────────────────────

interface BlockCardProps {
  block: EventScheduleBlock
  onUpdate: (blockId: string, data: UpdateScheduleBlockInput) => Promise<void>
  onDelete: (blockId: string) => Promise<void>
  isUpdating?: boolean
  isDeleting?: boolean
}

function BlockCard({ block, onUpdate, onDelete, isUpdating, isDeleting }: BlockCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const typeConfig = getBlockTypeConfig(block.type)
  const startsAt = parseISO(block.startsAt)
  const endsAt = parseISO(block.endsAt)
  const timeRange = `${format(startsAt, 'h:mm a')} – ${format(endsAt, 'h:mm a')}`

  const editInitial: BlockFormData = {
    type: block.type as BlockFormData['type'],
    title: block.title,
    description: block.description || '',
    date: format(startsAt, 'yyyy-MM-dd'),
    startTime: format(startsAt, 'HH:mm'),
    endTime: format(endsAt, 'HH:mm'),
    locationText: block.locationText || '',
  }

  async function handleUpdate(data: BlockFormData) {
    const startsAtDt = new Date(`${data.date}T${data.startTime}:00`)
    const endsAtDt = new Date(`${data.date}T${data.endTime}:00`)
    await onUpdate(block.id, {
      type: data.type,
      title: data.title,
      description: data.description || undefined,
      startsAt: startsAtDt,
      endsAt: endsAtDt,
      locationText: data.locationText || undefined,
    })
    setIsEditing(false)
  }

  return (
    <motion.div variants={listItem} className="ui-glass-hover rounded-xl overflow-hidden">
      {isEditing ? (
        <div className="p-3">
          <BlockForm
            initialData={editInitial}
            onSubmit={handleUpdate}
            onCancel={() => setIsEditing(false)}
            isSubmitting={isUpdating}
            submitLabel="Save Changes"
          />
        </div>
      ) : (
        <div
          className="p-4 cursor-pointer"
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          <div className="flex items-start gap-3">
            <span
              className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${typeConfig.bg} ${typeConfig.color}`}
            >
              {typeConfig.label}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{block.title}</p>
              <div className="flex items-center gap-3 mt-0.5">
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  {timeRange}
                </div>
                {block.locationText && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <MapPin className="w-3 h-3" />
                    {block.locationText}
                  </div>
                )}
                {block.lead && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <User className="w-3 h-3" />
                    {block.lead.firstName
                      ? `${block.lead.firstName} ${block.lead.lastName || ''}`.trim()
                      : block.lead.email}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 ml-2">
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </div>

          {/* Expanded details */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="pt-3 mt-3 border-t border-gray-100 space-y-2">
                  {block.description && (
                    <p className="text-sm text-gray-600">{block.description}</p>
                  )}
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200 transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(block.id)}
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

// ─── Main Component ───────────────────────────────────────────────────────────

interface EventScheduleTabProps {
  eventProjectId: string
  defaultDate?: string
}

export function EventScheduleTab({ eventProjectId, defaultDate }: EventScheduleTabProps) {
  const { data: blocks, isLoading } = useScheduleBlocks(eventProjectId)
  const createBlock = useCreateScheduleBlock(eventProjectId)
  const updateBlock = useUpdateScheduleBlock(eventProjectId)
  const deleteBlock = useDeleteScheduleBlock(eventProjectId)
  const { toast } = useToast()

  const [showAddForm, setShowAddForm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  async function handleCreate(data: BlockFormData) {
    const startsAt = new Date(`${data.date}T${data.startTime}:00`)
    const endsAt = new Date(`${data.date}T${data.endTime}:00`)
    const payload: CreateScheduleBlockInput = {
      type: data.type,
      title: data.title,
      description: data.description || undefined,
      startsAt,
      endsAt,
      locationText: data.locationText || undefined,
      sortOrder: blocks?.length ?? 0,
    }
    try {
      await createBlock.mutateAsync(payload)
      toast('Schedule block added', 'success')
      setShowAddForm(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to add block', 'error')
    }
  }

  async function handleUpdate(blockId: string, data: UpdateScheduleBlockInput) {
    setUpdatingId(blockId)
    try {
      await updateBlock.mutateAsync({ blockId, data })
      toast('Block updated', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update block', 'error')
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleDelete(blockId: string) {
    setDeletingId(blockId)
    try {
      await deleteBlock.mutateAsync(blockId)
      toast('Block removed', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to remove block', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading) return <ScheduleSkeleton />

  // Group blocks by date
  const groupedBlocks = (blocks || []).reduce<Record<string, EventScheduleBlock[]>>((acc, block) => {
    const dateKey = format(parseISO(block.startsAt), 'yyyy-MM-dd')
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(block)
    return acc
  }, {})
  const sortedDates = Object.keys(groupedBlocks).sort()

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Schedule</h3>
          {blocks && blocks.length > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">{blocks.length} block{blocks.length !== 1 ? 's' : ''}</p>
          )}
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Block
          </button>
        )}
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <BlockForm
              onSubmit={handleCreate}
              onCancel={() => setShowAddForm(false)}
              isSubmitting={createBlock.isPending}
              defaultDate={defaultDate}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Block list or empty state */}
      {!blocks || blocks.length === 0 ? (
        <ScheduleEmptyState onAdd={() => setShowAddForm(true)} />
      ) : (
        <motion.div
          variants={staggerContainer(0.04)}
          initial="hidden"
          animate="visible"
          className="space-y-4"
        >
          {sortedDates.map((dateKey) => (
            <div key={dateKey}>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 pl-1">
                {format(new Date(dateKey + 'T00:00:00'), 'EEEE, MMMM d')}
              </h4>
              <div className="space-y-2">
                {groupedBlocks[dateKey].map((block) => (
                  <BlockCard
                    key={block.id}
                    block={block}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                    isUpdating={updatingId === block.id}
                    isDeleting={deletingId === block.id}
                  />
                ))}
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
