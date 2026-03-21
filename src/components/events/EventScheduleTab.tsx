'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, parseISO, addMinutes, addDays, subDays } from 'date-fns'
import {
  DndContext,
  closestCenter,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
  useDroppable,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
// restrictToVerticalAxis removed — blocks need to move freely between sections
import {
  CalendarDays,
  Plus,
  MapPin,
  User,
  Clock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  GripVertical,
  Pencil,
  Trash2,
  FolderOpen,
  LayoutGrid,
  LayoutList,
  X,
  Upload,
  FileText,
  FileAudio,
  FileVideo,
  FileImage,
  FileSpreadsheet,
  File,
  Download,
  FileDown,
} from 'lucide-react'
import DetailDrawer from '@/components/DetailDrawer'
import ConfirmDialog from '@/components/ConfirmDialog'
import { staggerContainer, listItem, fadeInUp } from '@/lib/animations'
import {
  useScheduleBlocks,
  useCreateScheduleBlock,
  useUpdateScheduleBlock,
  useDeleteScheduleBlock,
  useReorderScheduleBlocks,
  useScheduleSections,
  useCreateScheduleSection,
  useUpdateScheduleSection,
  useDeleteScheduleSection,
  useAssignBlockToSection,
  useReorderSections,
  useBlockAttachments,
  useUploadBlockAttachment,
  useDeleteBlockAttachment,
  type EventScheduleSection,
  type ScheduleBlockAttachment,
} from '@/lib/hooks/useEventSchedule'
import { type EventScheduleBlock } from '@/lib/hooks/useEventProject'
import { useToast } from '@/components/Toast'
import { ParallelBlockGrid } from '@/components/events/ParallelBlockGrid'
import { ScheduleTimelineView } from '@/components/events/ScheduleTimelineView'
import { ExportScheduleDrawer } from '@/components/events/ExportScheduleDrawer'
import { PCOServiceLinkModal } from '@/components/events/PCOServiceLinkModal'
import { usePCOAutoSync, type SectionSyncStatus } from '@/lib/hooks/usePCOServices'
import type { CreateScheduleBlockInput, UpdateScheduleBlockInput, BlockTypeConfig } from '@/lib/types/event-project'

// ─── Color palette for custom types ──────────────────────────────────────────

const TYPE_COLORS = [
  { name: 'Red', value: '#ef4444', dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-100' },
  { name: 'Orange', value: '#f97316', dot: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-100' },
  { name: 'Amber', value: '#f59e0b', dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-100' },
  { name: 'Green', value: '#22c55e', dot: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-100' },
  { name: 'Blue', value: '#3b82f6', dot: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-100' },
  { name: 'Purple', value: '#a855f7', dot: 'bg-purple-500', text: 'text-purple-700', bg: 'bg-purple-100' },
  { name: 'Pink', value: '#ec4899', dot: 'bg-pink-500', text: 'text-pink-700', bg: 'bg-pink-100' },
  { name: 'Indigo', value: '#6366f1', dot: 'bg-indigo-500', text: 'text-indigo-700', bg: 'bg-indigo-100' },
  { name: 'Slate', value: '#64748b', dot: 'bg-slate-500', text: 'text-slate-700', bg: 'bg-slate-200' },
]

// ─── Block type config ────────────────────────────────────────────────────────
// BlockTypeConfig imported from @/lib/types/event-project

const DEFAULT_BLOCK_TYPES: BlockTypeConfig[] = [
  { value: 'SESSION', label: 'Session', dotColor: 'bg-blue-500', color: 'text-blue-700', bg: 'bg-blue-100' },
  { value: 'ACTIVITY', label: 'Activity', dotColor: 'bg-green-500', color: 'text-green-700', bg: 'bg-green-100' },
  { value: 'MEAL', label: 'Meal', dotColor: 'bg-amber-500', color: 'text-amber-700', bg: 'bg-amber-100' },
  { value: 'FREE_TIME', label: 'Free Time', dotColor: 'bg-slate-400', color: 'text-slate-600', bg: 'bg-slate-100' },
  { value: 'TRAVEL', label: 'Travel', dotColor: 'bg-purple-500', color: 'text-purple-700', bg: 'bg-purple-100' },
  { value: 'SETUP', label: 'Setup', dotColor: 'bg-orange-500', color: 'text-orange-700', bg: 'bg-orange-100' },
]

// Valid API enum values
const VALID_API_TYPES = ['SESSION', 'ACTIVITY', 'MEAL', 'FREE_TIME', 'TRAVEL', 'SETUP'] as const
type ApiBlockType = (typeof VALID_API_TYPES)[number]

/** Load custom types from localStorage for this event */
function loadCustomTypes(eventProjectId: string): BlockTypeConfig[] {
  try {
    const raw = localStorage.getItem(`schedule-custom-types-${eventProjectId}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveCustomTypes(eventProjectId: string, types: BlockTypeConfig[]) {
  try {
    localStorage.setItem(`schedule-custom-types-${eventProjectId}`, JSON.stringify(types))
  } catch {
    /* ignore */
  }
}

function getAllBlockTypes(eventProjectId: string, customTypes: BlockTypeConfig[]): BlockTypeConfig[] {
  return [...DEFAULT_BLOCK_TYPES, ...customTypes]
}

function getBlockTypeConfig(type: string, allTypes: BlockTypeConfig[]): BlockTypeConfig {
  return allTypes.find((t) => t.value === type) ?? DEFAULT_BLOCK_TYPES[0]
}

/** Map custom type value to the closest valid API enum. Custom types use ACTIVITY as fallback. */
function toApiType(typeValue: string): ApiBlockType {
  if ((VALID_API_TYPES as readonly string[]).includes(typeValue)) return typeValue as ApiBlockType
  return 'ACTIVITY'
}

/** Format minutes into a human-readable duration like "1h 30m" or "45m" */
function formatDuration(mins: number): string {
  if (mins < 0) mins = 0
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

// ─── Duration presets ────────────────────────────────────────────────────────

const DURATION_PRESETS = [5, 10, 15, 30, 45, 60, 90, 120] as const

/** Sentinel value for blocks not assigned to any section */
const UNSECTIONED = '__unsectioned__'

// ─── Time computation utilities ──────────────────────────────────────────────

interface ComputedBlockTime {
  computedStart: Date
  computedEnd: Date
}

/** Parse "HH:mm" into { hours, minutes }. Falls back to 08:00 if undefined/invalid. */
function parseHHMM(time24: string | undefined | null): { hours: number; minutes: number } {
  const safe = time24 || '08:00'
  const [h, m] = safe.split(':').map(Number)
  return { hours: h || 0, minutes: m || 0 }
}

/** Format "08:00" → "8:00 AM", "13:30" → "1:30 PM" */
function formatTime12(time24: string | undefined | null): string {
  const { hours, minutes } = parseHHMM(time24)
  const period = hours >= 12 ? 'PM' : 'AM'
  const h12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  return `${h12}:${String(minutes).padStart(2, '0')} ${period}`
}

/** Format a Date to "h:mm AM/PM" */
function formatDateTo12(d: Date): string {
  return format(d, 'h:mm a')
}

/**
 * Compute sequential start/end times for blocks within a section.
 * Block 1 starts at sectionStartTime, Block 2 starts when Block 1 ends, etc.
 *
 * IMPORTANT: Uses only the section's startTime string + block durations for
 * positioning. Does NOT use block.startsAt for positioning because server-side
 * code (e.g. PCO sync) stores times as UTC while the client interprets them
 * in local time, causing timezone mismatches. Durations (endsAt - startsAt)
 * are timezone-independent and safe to use.
 */
function computeBlockTimes(
  sectionStartTime: string | undefined | null,
  dateStr: string,
  blocks: EventScheduleBlock[],
): Map<string, ComputedBlockTime> {
  const result = new Map<string, ComputedBlockTime>()
  const { hours, minutes } = parseHHMM(sectionStartTime)
  const sectionStart = new Date(`${dateStr}T00:00:00`)
  sectionStart.setHours(hours, minutes, 0, 0)

  // Detect pre-items via metadata (not date comparison, which is timezone-sensitive).
  // Pre-items are always sorted first, so scan from the front.
  let preTotalMins = 0
  for (const block of blocks) {
    const meta = (block.metadata as Record<string, unknown>) || {}
    if (meta.servicePosition !== 'pre' && meta.pcoServicePosition !== 'pre') break
    const s = parseISO(block.startsAt)
    const e = parseISO(block.endsAt)
    preTotalMins += Math.max(Math.round((e.getTime() - s.getTime()) / 60000), 1)
  }

  // Pre-items start before the section time; non-pre blocks start at section time.
  let cursor: Date = preTotalMins > 0
    ? addMinutes(new Date(sectionStart), -preTotalMins)
    : new Date(sectionStart)

  for (const block of blocks) {
    const startsAt = parseISO(block.startsAt)
    const endsAt = parseISO(block.endsAt)
    const durationMs = endsAt.getTime() - startsAt.getTime()
    const durationMins = Math.max(Math.round(durationMs / 60000), 1)

    const computedStart = new Date(cursor)
    const computedEnd = addMinutes(computedStart, durationMins)

    result.set(block.id, { computedStart, computedEnd })
    cursor = computedEnd
  }

  return result
}

/**
 * Compute a smart default start time for a new section:
 * End time of the last block in the previous section (by sortOrder).
 * Falls back to "08:00" if no prior sections/blocks.
 */
function computeSmartDefaultStartTime(
  sections: EventScheduleSection[],
  sectionedBlocks: Record<string, EventScheduleBlock[]>,
  dateStr: string,
): string {
  if (sections.length === 0) return '08:00'

  // Walk sections in sortOrder, find the last one with blocks
  const sorted = [...sections].sort((a, b) => a.sortOrder - b.sortOrder)
  for (let i = sorted.length - 1; i >= 0; i--) {
    const section = sorted[i]
    const blocks = sectionedBlocks[section.id]
    if (blocks && blocks.length > 0) {
      if (section.layout === 'parallel') {
        // Parallel: end = startTime + max(block durations)
        const { hours, minutes } = parseHHMM(section.startTime)
        const start = new Date(`${dateStr}T00:00:00`)
        start.setHours(hours, minutes, 0, 0)
        const maxDuration = blocks.reduce((max, b) => {
          const s = new Date(b.startsAt).getTime()
          const e = new Date(b.endsAt).getTime()
          return Math.max(max, Math.round((e - s) / 60000))
        }, 0)
        const end = new Date(start.getTime() + maxDuration * 60000)
        const h = String(end.getHours()).padStart(2, '0')
        const m = String(end.getMinutes()).padStart(2, '0')
        return `${h}:${m}`
      }
      const times = computeBlockTimes(section.startTime, dateStr, blocks)
      const lastBlock = blocks[blocks.length - 1]
      const lastTime = times.get(lastBlock.id)
      if (lastTime) {
        const h = String(lastTime.computedEnd.getHours()).padStart(2, '0')
        const m = String(lastTime.computedEnd.getMinutes()).padStart(2, '0')
        return `${h}:${m}`
      }
    }
  }

  // No blocks in any section — use last section's startTime as base
  const lastSection = sorted[sorted.length - 1]
  return lastSection?.startTime || '08:00'
}

function formatPreset(mins: number): string {
  if (mins < 60) return `${mins}m`
  const h = mins / 60
  if (Number.isInteger(h)) return `${h}h`
  return `${Math.floor(h)}h ${mins % 60}m`
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function ScheduleSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-5 w-24 bg-slate-200 rounded" />
        <div className="h-9 w-28 bg-slate-200 rounded-full" />
      </div>
      {[...Array(2)].map((_, s) => (
        <div key={s} className="space-y-2">
          <div className="h-4 w-32 bg-slate-100 rounded" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl h-16" />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function ScheduleEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="text-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto mb-4">
        <CalendarDays className="w-7 h-7 text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-2">No schedule items yet</h3>
      <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
        Build your event schedule by adding items for sessions, activities, meals, and more.
      </p>
      <button
        onClick={onAdd}
        className="px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer"
      >
        Add First Block
      </button>
    </motion.div>
  )
}

// ─── Add Block Drawer ────────────────────────────────────────────────────────

interface DrawerFormData {
  type: string
  title: string
  description: string
  durationMinutes: number
  locationText: string
  servicePosition: 'pre' | 'during' | 'post'
}

const defaultDrawerForm: DrawerFormData = {
  type: 'SESSION',
  title: '',
  description: '',
  durationMinutes: 30,
  locationText: '',
  servicePosition: 'during',
}

interface AddBlockDrawerProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: DrawerFormData) => Promise<void>
  isSubmitting?: boolean
  allTypes: BlockTypeConfig[]
  onAddCustomType: (type: BlockTypeConfig) => void
  initialData?: Partial<DrawerFormData>
  submitLabel?: string
  eventProjectId?: string
  blockId?: string | null
}

function AddBlockDrawer({
  open,
  onClose,
  onSubmit,
  isSubmitting,
  allTypes,
  onAddCustomType,
  initialData,
  submitLabel = 'Save Item',
  eventProjectId,
  blockId,
}: AddBlockDrawerProps) {
  const [form, setForm] = useState<DrawerFormData>({ ...defaultDrawerForm, ...initialData })
  const [errors, setErrors] = useState<Partial<Record<keyof DrawerFormData, string>>>({})
  const [showCreateType, setShowCreateType] = useState(false)
  const [newTypeLabel, setNewTypeLabel] = useState('')
  const [newTypeColor, setNewTypeColor] = useState(TYPE_COLORS[0].value)
  const [customDuration, setCustomDuration] = useState('')
  const [activeTab, setActiveTab] = useState<'details' | 'files'>('details')
  const formRef = useRef<HTMLFormElement>(null)

  const isEditMode = !!blockId

  // Reset form when drawer opens
  useEffect(() => {
    if (open) {
      setForm({ ...defaultDrawerForm, ...initialData })
      setErrors({})
      setShowCreateType(false)
      setNewTypeLabel('')
      setNewTypeColor(TYPE_COLORS[0].value)
      setCustomDuration('')
      setActiveTab('details')
    }
  }, [open, initialData])

  function update<K extends keyof DrawerFormData>(key: K, value: DrawerFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    const newErrors: Partial<Record<keyof DrawerFormData, string>> = {}
    if (!form.title.trim()) newErrors.title = 'Title is required'
    if (!form.durationMinutes || form.durationMinutes <= 0) newErrors.durationMinutes = 'Duration is required'
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    await onSubmit(form)
  }

  function handleAddType() {
    if (!newTypeLabel.trim()) return
    const colorConfig = TYPE_COLORS.find((c) => c.value === newTypeColor) ?? TYPE_COLORS[0]
    const typeValue = `CUSTOM_${newTypeLabel.toUpperCase().replace(/\s+/g, '_')}`
    const newType: BlockTypeConfig = {
      value: typeValue,
      label: newTypeLabel.trim(),
      dotColor: colorConfig.dot,
      color: colorConfig.text,
      bg: colorConfig.bg,
      isCustom: true,
      hexColor: newTypeColor,
    }
    onAddCustomType(newType)
    setForm((prev) => ({ ...prev, type: typeValue }))
    setShowCreateType(false)
    setNewTypeLabel('')
    setNewTypeColor(TYPE_COLORS[0].value)
  }

  function handleCustomDurationApply() {
    const mins = parseInt(customDuration, 10)
    if (mins > 0) {
      update('durationMinutes', mins)
    }
  }

  // Split types into default and custom
  const defaultTypes = allTypes.filter((t) => !t.isCustom)
  const customTypesList = allTypes.filter((t) => t.isCustom)

  const drawerTitle = initialData?.title ? 'Edit Item' : 'Add Item'
  const isPresetSelected = (DURATION_PRESETS as readonly number[]).includes(form.durationMinutes)

  const footerContent = (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={onClose}
        className="px-5 py-3.5 rounded-full border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={() => handleSubmit()}
        disabled={isSubmitting}
        className="flex-1 py-3.5 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-60 transition cursor-pointer flex items-center justify-center gap-2"
      >
        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
        {submitLabel}
      </button>
    </div>
  )

  return (
    <DetailDrawer isOpen={open} onClose={onClose} title={drawerTitle} width="lg" footer={footerContent}>
      {/* Tabs — only show when editing an existing block */}
      {isEditMode && (
        <div className="flex gap-1 mb-6 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'details'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('files')}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'files'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Files
          </button>
        </div>
      )}

      {/* Details Tab */}
      {activeTab === 'details' && (
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
        {/* Block title */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Title</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="e.g. Morning Worship, Lunch..."
            className={`w-full px-4 py-3 text-sm bg-white border rounded-xl focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all ${
              errors.title ? 'border-red-300' : 'border-slate-200'
            }`}
          />
          {errors.title && <p className="text-xs text-red-500 mt-1.5">{errors.title}</p>}
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Type</label>
          {defaultTypes.length > 0 && (
            <>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Default</div>
              <div className="flex flex-wrap gap-2 mb-3">
                {defaultTypes.map((t) => {
                  const isSelected = form.type === t.value
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => update('type', t.value)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium transition-all cursor-pointer ${
                        isSelected
                          ? `${t.bg} ${t.color} ring-2 ring-offset-1 ring-slate-300`
                          : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.dotColor}`} />
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </>
          )}
          {customTypesList.length > 0 && (
            <>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Custom</div>
              <div className="flex flex-wrap gap-2 mb-3">
                {customTypesList.map((t) => {
                  const isSelected = form.type === t.value
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => update('type', t.value)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium transition-all cursor-pointer ${
                        isSelected
                          ? `ring-2 ring-offset-1 ring-slate-300`
                          : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                      style={isSelected ? { backgroundColor: `${t.hexColor}18`, color: t.hexColor } : undefined}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.hexColor }} />
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* Create custom type */}
          <div className="border-t border-slate-100 pt-3 mt-1">
            {!showCreateType ? (
              <button
                type="button"
                onClick={() => setShowCreateType(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-dashed border-slate-300 text-xs font-medium text-slate-500 hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                Create type
              </button>
            ) : (
              <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Label</label>
                  <input
                    type="text"
                    value={newTypeLabel}
                    onChange={(e) => setNewTypeLabel(e.target.value)}
                    placeholder="e.g. Chapel, Workshop, Keynote"
                    className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-2">Color</label>
                  <div className="flex flex-wrap gap-2">
                    {TYPE_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setNewTypeColor(c.value)}
                        className={`w-8 h-8 rounded-full transition-all cursor-pointer ${
                          newTypeColor === c.value ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: c.value }}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateType(false)
                      setNewTypeLabel('')
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddType}
                    disabled={!newTypeLabel.trim()}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-40 transition-all cursor-pointer"
                  >
                    Add type
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Position — Pre / During / Post */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Position</label>
          <div className="flex gap-2">
            {([
              { value: 'pre', label: 'Pre', color: 'text-blue-600 bg-blue-50 ring-blue-200' },
              { value: 'during', label: 'During', color: 'text-slate-700 bg-slate-100 ring-slate-300' },
              { value: 'post', label: 'Post', color: 'text-orange-600 bg-orange-50 ring-orange-200' },
            ] as const).map((pos) => {
              const isSelected = form.servicePosition === pos.value
              return (
                <button
                  key={pos.value}
                  type="button"
                  onClick={() => update('servicePosition', pos.value)}
                  className={`px-4 py-2 rounded-full text-xs font-medium transition-all cursor-pointer ${
                    isSelected
                      ? `${pos.color} ring-2 ring-offset-1`
                      : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {pos.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Duration — preset buttons + custom input */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Duration</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {DURATION_PRESETS.map((mins) => {
              const isSelected = form.durationMinutes === mins
              return (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    update('durationMinutes', mins)
                    setCustomDuration('')
                  }}
                  className={`px-3.5 py-2 rounded-full text-xs font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {formatPreset(mins)}
                </button>
              )
            })}
          </div>
          {/* Custom duration input */}
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={720}
              value={customDuration}
              onChange={(e) => setCustomDuration(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleCustomDurationApply()
                }
              }}
              placeholder="Custom minutes"
              className={`w-36 px-3 py-2 text-sm bg-white border rounded-lg focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-all ${
                !isPresetSelected && form.durationMinutes > 0 ? 'border-slate-400' : 'border-slate-200'
              }`}
            />
            <button
              type="button"
              onClick={handleCustomDurationApply}
              disabled={!customDuration || parseInt(customDuration, 10) <= 0}
              className="px-3 py-2 rounded-lg bg-slate-100 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-40 transition-all cursor-pointer"
            >
              Set
            </button>
            {!isPresetSelected && form.durationMinutes > 0 && (
              <span className="text-xs text-slate-500 font-medium">{formatDuration(form.durationMinutes)}</span>
            )}
          </div>
          {errors.durationMinutes && <p className="text-xs text-red-500 mt-1.5">{errors.durationMinutes}</p>}
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Location (optional)</label>
          <input
            type="text"
            value={form.locationText}
            onChange={(e) => update('locationText', e.target.value)}
            placeholder="e.g. Main Hall, Beach Pavilion"
            className="w-full px-4 py-3 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Notes (optional)</label>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={3}
            placeholder="Instructions, details, leaders..."
            className="w-full px-4 py-3 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 resize-y transition-all"
          />
        </div>
      </form>
      )}

      {/* Files Tab */}
      {activeTab === 'files' && isEditMode && eventProjectId && blockId && (
        <BlockFilesTab eventProjectId={eventProjectId} blockId={blockId} />
      )}
    </DetailDrawer>
  )
}

// ─── File icon helper ────────────────────────────────────────────────────────

function getFileIcon(contentType: string, fileName: string) {
  if (contentType.startsWith('audio/') || fileName.match(/\.(mp3|wav|aac|flac|ogg|m4a)$/i))
    return <FileAudio className="w-5 h-5 text-purple-500" />
  if (contentType.startsWith('video/') || fileName.match(/\.(mp4|mov|avi|mkv|webm)$/i))
    return <FileVideo className="w-5 h-5 text-blue-500" />
  if (contentType.startsWith('image/') || fileName.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i))
    return <FileImage className="w-5 h-5 text-green-500" />
  if (contentType.includes('spreadsheet') || contentType.includes('excel') || fileName.match(/\.(xlsx|xls|csv)$/i))
    return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
  if (contentType.includes('pdf') || fileName.match(/\.pdf$/i))
    return <FileText className="w-5 h-5 text-red-500" />
  if (contentType.includes('presentation') || contentType.includes('powerpoint') || fileName.match(/\.(pptx|ppt|key)$/i))
    return <FileText className="w-5 h-5 text-orange-500" />
  if (fileName.match(/\.(pro[4-7]?|pro6x|pro6plx)$/i))
    return <FileText className="w-5 h-5 text-indigo-500" />
  return <File className="w-5 h-5 text-slate-400" />
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Block Files Tab ─────────────────────────────────────────────────────────

interface BlockFilesTabProps {
  eventProjectId: string
  blockId: string
}

function BlockFilesTab({ eventProjectId, blockId }: BlockFilesTabProps) {
  const { data: attachments, isLoading } = useBlockAttachments(eventProjectId, blockId)
  const uploadMutation = useUploadBlockAttachment(eventProjectId, blockId)
  const deleteMutation = useDeleteBlockAttachment(eventProjectId, blockId)
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ name: string; progress: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  async function handleFiles(files: FileList | File[]) {
    const fileArray = Array.from(files)
    for (const file of fileArray) {
      if (file.size > 50 * 1024 * 1024) {
        toast(`${file.name} exceeds 50MB limit`, 'error')
        continue
      }

      setUploadProgress({ name: file.name, progress: 30 })

      try {
        // Convert to base64
        const buffer = await file.arrayBuffer()
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        )

        setUploadProgress({ name: file.name, progress: 60 })

        await uploadMutation.mutateAsync({
          fileName: file.name,
          fileBase64: base64,
          contentType: file.type || 'application/octet-stream',
        })

        setUploadProgress({ name: file.name, progress: 100 })
        toast(`${file.name} uploaded`, 'success')
      } catch (err) {
        toast(
          `Failed to upload ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`,
          'error',
        )
      } finally {
        setUploadProgress(null)
      }
    }
  }

  async function handleDelete(attachmentId: string, fileName: string) {
    if (!confirm(`Delete "${fileName}"?`)) return
    try {
      await deleteMutation.mutateAsync(attachmentId)
      toast(`${fileName} deleted`, 'success')
    } catch {
      toast(`Failed to delete ${fileName}`, 'error')
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files?.length) {
      handleFiles(e.dataTransfer.files)
    }
  }

  function getUploaderName(att: ScheduleBlockAttachment): string {
    if (!att.uploadedBy) return 'Unknown'
    const { firstName, lastName, name } = att.uploadedBy
    if (firstName || lastName) return [firstName, lastName].filter(Boolean).join(' ')
    return name || 'Unknown'
  }

  return (
    <div className="space-y-4">
      {/* Upload dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          isDragOver
            ? 'border-blue-400 bg-blue-50/50'
            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) {
              handleFiles(e.target.files)
              e.target.value = ''
            }
          }}
        />
        <div className={`w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center ${isDragOver ? 'bg-blue-100' : 'bg-slate-100'}`}>
          <Upload className={`w-5 h-5 ${isDragOver ? 'text-blue-500' : 'text-slate-400'}`} />
        </div>
        <p className="text-sm font-medium text-slate-700">
          <span className="text-blue-600">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-slate-400 mt-1">Any file type up to 50MB</p>
      </div>

      {/* Upload progress */}
      {uploadProgress && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <Loader2 className="w-4 h-4 animate-spin text-blue-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-700 truncate">{uploadProgress.name}</p>
            <div className="w-full bg-blue-100 rounded-full h-1 mt-1.5">
              <div
                className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress.progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* File list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !attachments?.length ? (
        <div className="text-center py-8">
          <FolderOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No files attached yet</p>
          <p className="text-xs text-slate-400 mt-0.5">Chord charts, audio, presentations, and more</p>
        </div>
      ) : (
        <div className="space-y-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all group"
            >
              {/* File icon */}
              <div className="flex-shrink-0">
                {getFileIcon(att.contentType, att.fileName)}
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{att.fileName}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {formatFileSize(att.sizeBytes)} · {format(new Date(att.createdAt), 'MMM d, yyyy')} · {getUploaderName(att)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <a
                  href={att.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title="Download"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => handleDelete(att.id, att.fileName)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Block Row (used in both sortable list and drag overlay) ─────────────────

interface BlockRowContentProps {
  block: EventScheduleBlock
  allTypes: BlockTypeConfig[]
  durationMins: number
  timeRange: string
  isDragging?: boolean
  isOverlay?: boolean
}

function BlockRowContent({ block, allTypes, durationMins, timeRange, isDragging, isOverlay }: BlockRowContentProps) {
  const displayType = (block.metadata as Record<string, unknown>)?.customType as string | undefined
  const typeConfig = getBlockTypeConfig(displayType || block.type, allTypes)
  const meta = (block.metadata as Record<string, unknown>) || {}
  const servicePos = (meta.servicePosition || meta.pcoServicePosition) as string | undefined

  return (
    <>
      {/* Category bar */}
      <div
        className={`flex-shrink-0 w-0.5 self-stretch rounded-full ${typeConfig.hexColor ? '' : typeConfig.dotColor}`}
        style={typeConfig.hexColor ? { backgroundColor: typeConfig.hexColor } : undefined}
      />

      {/* Title + time underneath */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-slate-900 truncate">{block.title}</span>
          {servicePos === 'pre' && (
            <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full flex-shrink-0">Pre</span>
          )}
          {servicePos === 'post' && (
            <span className="text-[10px] font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full flex-shrink-0">Post</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {!isOverlay && timeRange && (
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Clock className="w-3 h-3 flex-shrink-0" />
              <span>{timeRange}</span>
            </div>
          )}
          {block.locationText && (
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate max-w-[120px]">{block.locationText}</span>
            </div>
          )}
          {block.lead && (
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <User className="w-3 h-3 flex-shrink-0" />
              <span className="truncate max-w-[100px]">
                {block.lead.firstName
                  ? `${block.lead.firstName} ${block.lead.lastName || ''}`.trim()
                  : block.lead.email}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Duration pill — at the end */}
      {!isOverlay && (
        <div className="flex-shrink-0 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-100">
          <span className="text-xs font-medium text-slate-500">{formatDuration(durationMins)}</span>
        </div>
      )}
    </>
  )
}

// ─── Sortable Block Row ─────────────────────────────────────────────────────

interface SortableBlockRowProps {
  block: EventScheduleBlock
  allTypes: BlockTypeConfig[]
  durationMins: number
  timeRange: string
  onEdit: (block: EventScheduleBlock) => void
  onDelete: (blockId: string) => void
  isDeleting?: boolean
}

function SortableBlockRow({
  block,
  allTypes,
  durationMins,
  timeRange,
  onEdit,
  onDelete,
  isDeleting,
}: SortableBlockRowProps) {
  const [isHovered, setIsHovered] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isSorting } = useSortable({
    id: block.id,
    transition: {
      duration: 250,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    },
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
    position: 'relative' as const,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative flex items-center gap-3 px-3 py-3 bg-white border rounded-xl cursor-default ${
        isDragging
          ? 'border-indigo-300 shadow-lg ring-2 ring-indigo-100'
          : isSorting
            ? '' // During sort animation, don't add extra transitions that fight dnd-kit
            : 'hover:border-slate-300 hover:shadow-sm transition-colors'
      } ${!isDragging && !isSorting ? 'border-slate-200/80' : 'border-slate-200/80'}`}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 p-1.5 -m-1.5 rounded-lg opacity-40 group-hover:opacity-70 hover:bg-slate-100 transition-all cursor-grab active:cursor-grabbing"
        role="button"
        aria-label={`Reorder ${block.title}`}
      >
        <GripVertical className="w-4 h-4 text-slate-400" />
      </div>

      <BlockRowContent
        block={block}
        allTypes={allTypes}
        durationMins={durationMins}
        timeRange={timeRange}
      />

      {/* Hover actions — overlays on top of the duration pill */}
      <div className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pl-4 bg-gradient-to-l from-white via-white to-transparent transition-opacity ${isHovered && !isDragging ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <button
          onClick={() => onEdit(block)}
          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(block.id)}
          disabled={isDeleting}
          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-red-500 hover:bg-red-50 hover:border-red-200 transition-all cursor-pointer disabled:opacity-60"
        >
          {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
        </button>
      </div>
    </div>
  )
}

// ─── Drag Overlay Preview ────────────────────────────────────────────────────

function BlockRowOverlay({ block, allTypes }: { block: EventScheduleBlock; allTypes: BlockTypeConfig[] }) {
  return (
    <div className="flex items-center gap-3 px-3 py-3 bg-white border-2 border-indigo-300 rounded-xl shadow-xl ring-4 ring-indigo-50 cursor-grabbing max-w-[500px]">
      <div className="flex-shrink-0 p-1.5">
        <GripVertical className="w-4 h-4 text-indigo-400" />
      </div>
      <BlockRowContent block={block} allTypes={allTypes} durationMins={0} timeRange="" isOverlay />
    </div>
  )
}

// ─── Droppable Section Container ─────────────────────────────────────────────

interface DroppableSectionProps {
  sectionId: string
  children: React.ReactNode
  isOver?: boolean
}

function DroppableSection({ sectionId, children, isOver }: DroppableSectionProps) {
  const { setNodeRef, isOver: dropIsOver } = useDroppable({ id: `section-${sectionId}` })
  const active = isOver || dropIsOver

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[48px] rounded-xl transition-all ${
        active ? 'bg-indigo-50/50 ring-2 ring-indigo-200 ring-dashed' : ''
      }`}
    >
      {children}
    </div>
  )
}

// ─── Sortable Section Wrapper ────────────────────────────────────────────────

interface SortableSectionCardProps {
  section: EventScheduleSection
  children: (listeners: Record<string, unknown>) => React.ReactNode
}

function SortableSectionCard({ section, children }: SortableSectionCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `sortable-section-${section.id}` })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {children(listeners ?? {})}
    </div>
  )
}

// ─── Section Header (editable inline, with drag handle) ─────────────────────

interface SectionHeaderProps {
  section: EventScheduleSection
  blockCount: number
  totalDuration: number
  timeSpan: string  // e.g. "8:00 AM – 10:30 AM"
  onRename: (newTitle: string) => void
  onStartTimeChange: (newTime: string) => void
  onLayoutChange: (layout: 'sequential' | 'parallel') => void
  onDelete: () => void
  onAddBlock: () => void
  onLinkPCO?: () => void
  hasPCOLink?: boolean
  dragListeners?: Record<string, unknown>
}

function SectionHeader({ section, blockCount, totalDuration, timeSpan, onRename, onStartTimeChange, onLayoutChange, onDelete, onAddBlock, onLinkPCO, hasPCOLink, dragListeners }: SectionHeaderProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(section.title)
  const [isEditingTime, setIsEditingTime] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timeInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  useEffect(() => {
    if (isEditingTime && timeInputRef.current) {
      timeInputRef.current.focus()
    }
  }, [isEditingTime])

  function handleSave() {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== section.title) {
      onRename(trimmed)
    } else {
      setEditValue(section.title)
    }
    setIsEditing(false)
  }

  function handleTimeSave(value: string) {
    if (value && value !== section.startTime) {
      onStartTimeChange(value)
    }
    setIsEditingTime(false)
  }

  return (
    <div className="flex items-center justify-between mb-2 group/header">
      <div className="flex items-center gap-2.5">
        {/* Drag handle for section reordering */}
        <button
          className="p-1 -ml-1 rounded text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none"
          title="Drag to reorder section"
          {...(dragListeners || {})}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <FolderOpen className="w-4 h-4 text-slate-400" />
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') { setEditValue(section.title); setIsEditing(false) }
            }}
            className="text-sm font-semibold text-slate-900 bg-transparent border-b border-indigo-400 outline-none px-0 py-0"
          />
        ) : (
          <h4
            className="text-sm font-semibold text-slate-900 cursor-pointer hover:text-indigo-600 transition-colors"
            onClick={() => setIsEditing(true)}
            title="Click to rename"
          >
            {section.title}
          </h4>
        )}
        {/* Time span — clickable to edit start time */}
        {isEditingTime ? (
          <input
            ref={timeInputRef}
            type="time"
            defaultValue={section.startTime}
            onBlur={(e) => handleTimeSave(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTimeSave((e.target as HTMLInputElement).value)
              if (e.key === 'Escape') setIsEditingTime(false)
            }}
            className="text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-100"
          />
        ) : (
          <button
            onClick={() => setIsEditingTime(true)}
            className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg px-2 py-1 transition-all cursor-pointer"
            title="Click to change section start time"
          >
            <Clock className="w-3 h-3" />
            {timeSpan}
          </button>
        )}
        {section.layout === 'parallel' && (
          <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-semibold uppercase tracking-wider">
            Breakout
          </span>
        )}
        <span className="text-xs text-slate-400">
          {blockCount} item{blockCount !== 1 ? 's' : ''}
          {totalDuration > 0 && ` · ${formatDuration(totalDuration)}`}
        </span>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover/header:opacity-100 transition-opacity">
        {onLinkPCO && (
          <button
            onClick={onLinkPCO}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${hasPCOLink ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
            title={hasPCOLink ? 'Manage Planning Center link' : 'Link to Planning Center'}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6.5 9.5L9.5 6.5M5.5 10.5L3.5 12.5C2.9 13.1 2.9 14.1 3.5 14.7V14.7C4.1 15.3 5.1 15.3 5.7 14.7L7.7 12.7M10.5 5.5L12.5 3.5C13.1 2.9 13.1 1.9 12.5 1.3V1.3C11.9 0.7 10.9 0.7 10.3 1.3L8.3 3.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        <button
          onClick={() => onLayoutChange(section.layout === 'parallel' ? 'sequential' : 'parallel')}
          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer"
          title={section.layout === 'parallel' ? 'Switch to sequential layout' : 'Switch to parallel (breakout) layout'}
        >
          {section.layout === 'parallel' ? <LayoutList className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={onAddBlock}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
          title="Add block to section"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setIsEditing(true)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
          title="Rename section"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer"
          title="Delete section (items are kept)"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Section Block List ─────────────────────────────────────────────────────

interface SectionBlockListProps {
  blocks: EventScheduleBlock[]
  allTypes: BlockTypeConfig[]
  computedTimes?: Map<string, ComputedBlockTime>
  onEditBlock: (block: EventScheduleBlock) => void
  onDelete: (blockId: string) => void
  deletingId: string | null
}

function SectionBlockList({ blocks, allTypes, computedTimes, onEditBlock, onDelete, deletingId }: SectionBlockListProps) {
  return (
    <div className="space-y-1.5">
      {blocks.map((block) => {
        const startsAt = parseISO(block.startsAt)
        const endsAt = parseISO(block.endsAt)
        const durationMins = Math.max(Math.round((endsAt.getTime() - startsAt.getTime()) / 60000), 1)

        // Use computed times if available, otherwise show duration only
        const computed = computedTimes?.get(block.id)
        const timeRange = computed
          ? `${formatDateTo12(computed.computedStart)} – ${formatDateTo12(computed.computedEnd)}`
          : `${formatDuration(durationMins)}`

        return (
          <SortableBlockRow
            key={block.id}
            block={block}
            allTypes={allTypes}
            durationMins={durationMins}
            timeRange={timeRange}
            onEdit={onEditBlock}
            onDelete={onDelete}
            isDeleting={deletingId === block.id}
          />
        )
      })}
    </div>
  )
}

// ─── Mini visual illustrations for the Add menu ─────────────────────────────

/** Three stacked horizontal bars — represents a single time block */
function BlockIllustration() {
  return (
    <div className="w-full flex flex-col gap-1 px-1">
      <div className="h-1.5 w-full rounded-full bg-blue-400" />
      <div className="h-1 w-3/4 rounded-full bg-slate-200" />
      <div className="h-1 w-1/2 rounded-full bg-slate-200" />
    </div>
  )
}

/** Multiple stacked rows inside a folder — represents a sequential section */
function SectionIllustration() {
  return (
    <div className="w-full flex flex-col gap-1 px-1">
      <div className="h-1 w-10 rounded-full bg-slate-300" />
      <div className="flex flex-col gap-0.5 pl-1.5">
        <div className="flex items-center gap-1">
          <div className="w-0.5 h-3 rounded-full bg-green-400 flex-shrink-0" />
          <div className="h-1.5 flex-1 rounded-full bg-slate-200" />
        </div>
        <div className="flex items-center gap-1">
          <div className="w-0.5 h-3 rounded-full bg-amber-400 flex-shrink-0" />
          <div className="h-1.5 flex-1 rounded-full bg-slate-200" />
        </div>
        <div className="flex items-center gap-1">
          <div className="w-0.5 h-3 rounded-full bg-purple-400 flex-shrink-0" />
          <div className="h-1.5 flex-1 rounded-full bg-slate-200" />
        </div>
      </div>
    </div>
  )
}

/** 2×2 card grid — represents a parallel / breakout section */
function BreakoutIllustration() {
  return (
    <div className="w-full flex flex-col gap-1 px-1">
      <div className="h-1 w-10 rounded-full bg-indigo-300" />
      <div className="grid grid-cols-2 gap-1 pl-1.5">
        {[
          'bg-blue-400',
          'bg-green-400',
          'bg-amber-400',
          'bg-purple-400',
        ].map((color) => (
          <div key={color} className="rounded bg-slate-100 border border-slate-200/60 p-0.5">
            <div className={`h-0.5 w-3 rounded-full ${color} mb-0.5`} />
            <div className="h-0.5 w-full rounded-full bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  )
}


// ─── Unified Add Dropdown ────────────────────────────────────────────────────

type AddMenuChoice = 'block' | 'section' | 'breakout'

interface AddScheduleDropdownProps {
  onAddBlock: () => void
  onAddSection: (title: string) => void
  onAddBreakout: (title: string) => void
}

function AddScheduleDropdown({ onAddBlock, onAddSection, onAddBreakout }: AddScheduleDropdownProps) {
  const [open, setOpen] = useState(false)
  const [naming, setNaming] = useState<AddMenuChoice | null>(null)
  const [title, setTitle] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setNaming(null)
        setTitle('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Auto-focus the input when naming mode activates
  useEffect(() => {
    if (naming && inputRef.current) {
      inputRef.current.focus()
    }
  }, [naming])

  function handleSelect(choice: AddMenuChoice) {
    if (choice === 'block') {
      onAddBlock()
      setOpen(false)
      setNaming(null)
    } else {
      setNaming(choice)
      setTitle('')
    }
  }

  function handleSubmitName() {
    const trimmed = title.trim()
    if (!trimmed || !naming) return
    if (naming === 'section') onAddSection(trimmed)
    else onAddBreakout(trimmed)
    setTitle('')
    setNaming(null)
    setOpen(false)
  }

  const options: { key: AddMenuChoice; label: string; description: string; illustration: React.ReactNode }[] = [
    {
      key: 'block',
      label: 'Item',
      description: 'A single time slot — session, meal, activity',
      illustration: <BlockIllustration />,
    },
    {
      key: 'section',
      label: 'Section',
      description: 'Group items that run one after another',
      illustration: <SectionIllustration />,
    },
    {
      key: 'breakout',
      label: 'Breakout',
      description: 'Parallel sessions happening at the same time',
      illustration: <BreakoutIllustration />,
    },
  ]

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => { setOpen((prev) => !prev); setNaming(null); setTitle('') }}
        className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        Add
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden"
          >
            {/* Inline name input — slides in when section/breakout chosen */}
            {naming ? (
              <div className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  {naming === 'breakout' ? (
                    <LayoutGrid className="w-4 h-4 text-indigo-500" />
                  ) : (
                    <FolderOpen className="w-4 h-4 text-slate-500" />
                  )}
                  <span className="text-sm font-medium text-slate-900">
                    {naming === 'breakout' ? 'New Breakout' : 'New Section'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSubmitName()
                      if (e.key === 'Escape') { setNaming(null); setTitle('') }
                    }}
                    placeholder={naming === 'breakout' ? 'Breakout name...' : 'Section name...'}
                    className="flex-1 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-all"
                  />
                  <button
                    onClick={handleSubmitName}
                    disabled={!title.trim()}
                    className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-40 transition-all cursor-pointer"
                  >
                    Add
                  </button>
                </div>
                <button
                  onClick={() => { setNaming(null); setTitle('') }}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  &larr; Back
                </button>
              </div>
            ) : (
              <div className="py-1">
                {options.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => handleSelect(opt.key)}
                    className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                  >
                    {/* Mini illustration */}
                    <div className="flex-shrink-0 w-14 h-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden">
                      {opt.illustration}
                    </div>
                    {/* Label + description */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="text-sm font-medium text-slate-900">{opt.label}</div>
                      <div className="text-xs text-slate-400 leading-snug mt-0.5">{opt.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface EventScheduleTabProps {
  eventProjectId: string
  defaultDate?: string
  eventStartDate?: string
  eventEndDate?: string
}

export function EventScheduleTab({ eventProjectId, defaultDate, eventStartDate, eventEndDate }: EventScheduleTabProps) {
  const [viewMode, setViewMode] = useState<'order' | 'timeline'>('order')
  const [exportDrawerOpen, setExportDrawerOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingBlock, setEditingBlock] = useState<EventScheduleBlock | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [addToSectionId, setAddToSectionId] = useState<string | null>(null)
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const [pcoLinkSectionId, setPcoLinkSectionId] = useState<string | null>(null)
  const [confirmDeleteBlock, setConfirmDeleteBlock] = useState<{ id: string; title: string } | null>(null)
  const [confirmDeleteSection, setConfirmDeleteSection] = useState<{ id: string; title: string; blockCount: number } | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const candidate = defaultDate
      ? new Date(defaultDate + 'T00:00:00')
      : new Date(format(new Date(), 'yyyy-MM-dd') + 'T00:00:00')
    // Clamp to event date range
    if (eventStartDate && eventEndDate) {
      const start = new Date(eventStartDate + 'T00:00:00')
      const end = new Date(eventEndDate + 'T00:00:00')
      if (candidate < start) return start
      if (candidate > end) return end
    }
    return candidate
  })

  // Derive the date string for section queries (must be before hooks)
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd')

  const { data: blocks, isLoading: blocksLoading } = useScheduleBlocks(eventProjectId)
  const { data: sections, isLoading: sectionsLoading } = useScheduleSections(eventProjectId, selectedDateStr)
  const createBlock = useCreateScheduleBlock(eventProjectId)
  const updateBlock = useUpdateScheduleBlock(eventProjectId)
  const deleteBlock = useDeleteScheduleBlock(eventProjectId)
  const reorderBlocks = useReorderScheduleBlocks(eventProjectId)
  const createSection = useCreateScheduleSection(eventProjectId, selectedDateStr)
  const updateSection = useUpdateScheduleSection(eventProjectId, selectedDateStr)
  const deleteSection = useDeleteScheduleSection(eventProjectId, selectedDateStr)
  const assignBlock = useAssignBlockToSection(eventProjectId)
  const reorderSections = useReorderSections(eventProjectId, selectedDateStr)
  const { toast } = useToast()

  // Auto-sync PCO-linked sections on mount (update-only — detects new items but doesn't import them)
  const pcoAutoSync = usePCOAutoSync(eventProjectId)
  const pcoAutoSyncFired = useRef(false)
  const [pcoSectionStatuses, setPcoSectionStatuses] = useState<Record<string, SectionSyncStatus>>({})
  useEffect(() => {
    if (eventProjectId && !pcoAutoSyncFired.current) {
      pcoAutoSyncFired.current = true
      pcoAutoSync.mutate(undefined, {
        onSuccess: (data) => {
          if (data.sections && data.sections.length > 0) {
            const statusMap: Record<string, SectionSyncStatus> = {}
            for (const s of data.sections) {
              if (s.newItemCount > 0) statusMap[s.sectionId] = s
            }
            setPcoSectionStatuses(statusMap)
          }
        },
      })
    }
  }, [eventProjectId]) // eslint-disable-line react-hooks/exhaustive-deps

  const [customTypes, setCustomTypes] = useState<BlockTypeConfig[]>(() => loadCustomTypes(eventProjectId))
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null)
  // Local container map: tracks block→sectionId assignments during drag for visual shifting
  const [dragContainerMap, setDragContainerMap] = useState<Record<string, string> | null>(null)
  // Local order map: tracks the order of blocks within each container during drag
  const [dragOrderMap, setDragOrderMap] = useState<Record<string, string[]> | null>(null)

  // Build array of valid event dates for bounded navigation
  const eventDates = useMemo(() => {
    if (!eventStartDate || !eventEndDate) return null
    const start = new Date(eventStartDate + 'T00:00:00')
    const end = new Date(eventEndDate + 'T00:00:00')
    const dates: Date[] = []
    let cursor = start
    while (cursor <= end) {
      dates.push(cursor)
      cursor = addDays(cursor, 1)
    }
    return dates
  }, [eventStartDate, eventEndDate])

  const currentDateIndex = useMemo(() => {
    if (!eventDates) return -1
    const key = format(selectedDate, 'yyyy-MM-dd')
    return eventDates.findIndex((d) => format(d, 'yyyy-MM-dd') === key)
  }, [eventDates, selectedDate])

  const canGoPrev = eventDates ? currentDateIndex > 0 : false
  const canGoNext = eventDates ? currentDateIndex >= 0 && currentDateIndex < eventDates.length - 1 : false

  const allTypes = useMemo(() => getAllBlockTypes(eventProjectId, customTypes), [eventProjectId, customTypes])

  function handleAddCustomType(type: BlockTypeConfig) {
    const updated = [...customTypes, type]
    setCustomTypes(updated)
    saveCustomTypes(eventProjectId, updated)
  }

  // ─── Block CRUD ───────────────────────────────────────────────────────

  async function handleCreate(data: DrawerFormData) {
    const dateStr = selectedDateStr

    // Compute start time based on position in section
    let startsAt: Date
    if (addToSectionId && sections) {
      const section = sections.find((s) => s.id === addToSectionId)
      const sectionBlocks = sectionedBlocks.map[addToSectionId] || []

      if (section?.layout === 'parallel') {
        // Parallel sections: all blocks share the section start time
        const { hours, minutes } = parseHHMM(section.startTime)
        startsAt = new Date(`${dateStr}T00:00:00`)
        startsAt.setHours(hours, minutes, 0, 0)
      } else if (section && sectionBlocks.length > 0) {
        // Sequential: append after last block
        const times = computeBlockTimes(section.startTime, dateStr, sectionBlocks)
        const lastBlock = sectionBlocks[sectionBlocks.length - 1]
        const lastTime = times.get(lastBlock.id)
        startsAt = lastTime ? new Date(lastTime.computedEnd) : new Date(`${dateStr}T08:00:00`)
      } else if (section) {
        // First block in section: use section startTime
        const { hours, minutes } = parseHHMM(section.startTime)
        startsAt = new Date(`${dateStr}T00:00:00`)
        startsAt.setHours(hours, minutes, 0, 0)
      } else {
        startsAt = new Date(`${dateStr}T08:00:00`)
      }
    } else {
      startsAt = new Date(`${dateStr}T08:00:00`)
    }

    // Pre items: offset backward from section start so they end when the section begins
    if (data.servicePosition === 'pre' && addToSectionId && sections) {
      const section = sections.find((s) => s.id === addToSectionId)
      if (section) {
        const { hours, minutes } = parseHHMM(section.startTime)
        const sectionStart = new Date(`${dateStr}T00:00:00`)
        sectionStart.setHours(hours, minutes, 0, 0)
        // Find existing pre items to stack before them
        const sectionBlocks = sectionedBlocks.map[addToSectionId] || []
        const existingPreItems = sectionBlocks.filter((b) => {
          const m = (b.metadata as Record<string, unknown>) || {}
          return m.servicePosition === 'pre' || m.pcoServicePosition === 'pre'
        })
        const existingPreTotal = existingPreItems.reduce((sum, b) => {
          const s = parseISO(b.startsAt)
          const e = parseISO(b.endsAt)
          return sum + Math.max(Math.round((e.getTime() - s.getTime()) / 60000), 1)
        }, 0)
        // New pre item starts before existing pre items
        startsAt = addMinutes(sectionStart, -(existingPreTotal + data.durationMinutes))
      }
    }

    const endsAt = addMinutes(startsAt, data.durationMinutes)

    const isCustomType = !VALID_API_TYPES.includes(data.type as ApiBlockType)
    const metadata: Record<string, unknown> = {}
    if (isCustomType) metadata.customType = data.type
    if (data.servicePosition && data.servicePosition !== 'during') metadata.servicePosition = data.servicePosition
    const payload: CreateScheduleBlockInput = {
      type: toApiType(data.type),
      title: data.title,
      description: data.description || undefined,
      startsAt,
      endsAt,
      locationText: data.locationText || undefined,
      sectionId: addToSectionId ?? undefined,
      sortOrder: blocks?.length ?? 0,
      ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    }
    try {
      await createBlock.mutateAsync(payload)
      toast('Item added', 'success')
      setDrawerOpen(false)
      setAddToSectionId(null)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to add item', 'error')
    }
  }

  async function handleUpdate(data: DrawerFormData) {
    if (!editingBlock) return

    // Use computed start time for the block's current position
    const computed = computedTimesMap.get(editingBlock.id)
    const startsAt = computed ? new Date(computed.computedStart) : parseISO(editingBlock.startsAt)
    const endsAt = addMinutes(startsAt, data.durationMinutes)

    const isCustomType = !VALID_API_TYPES.includes(data.type as ApiBlockType)
    // Merge with existing metadata (preserve PCO fields etc.)
    const existingMeta = (editingBlock.metadata as Record<string, unknown>) || {}
    const updatedMeta: Record<string, unknown> = { ...existingMeta }
    // Set or clear customType
    if (isCustomType) { updatedMeta.customType = data.type } else { delete updatedMeta.customType }
    // Set or clear servicePosition
    if (data.servicePosition && data.servicePosition !== 'during') {
      updatedMeta.servicePosition = data.servicePosition
    } else {
      delete updatedMeta.servicePosition
      delete updatedMeta.pcoServicePosition // clean up legacy key too
    }
    const updateData: UpdateScheduleBlockInput = {
      type: toApiType(data.type),
      title: data.title,
      description: data.description || undefined,
      startsAt,
      endsAt,
      locationText: data.locationText || undefined,
      metadata: Object.keys(updatedMeta).length > 0 ? updatedMeta : null,
    }
    try {
      await updateBlock.mutateAsync({ blockId: editingBlock.id, data: updateData })
      toast('Item updated', 'success')
      setEditingBlock(null)
      setDrawerOpen(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update item', 'error')
    }
  }

  function handleDelete(blockId: string) {
    const block = blocks?.find((b) => b.id === blockId)
    setConfirmDeleteBlock({ id: blockId, title: block?.title || 'this item' })
  }

  async function executeDeleteBlock() {
    if (!confirmDeleteBlock) return
    setDeletingId(confirmDeleteBlock.id)
    try {
      await deleteBlock.mutateAsync(confirmDeleteBlock.id)
      toast('Item removed', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to remove item', 'error')
    } finally {
      setDeletingId(null)
      setConfirmDeleteBlock(null)
    }
  }

  function handleReorder(blockIds: string[]) {
    reorderBlocks.mutate(blockIds)
  }

  function openAddDrawer(sectionId?: string | null) {
    setEditingBlock(null)
    setAddToSectionId(sectionId ?? null)
    setDrawerOpen(true)
  }

  function openEditDrawer(block: EventScheduleBlock) {
    setEditingBlock(block)
    setDrawerOpen(true)
  }

  // ─── Section CRUD ─────────────────────────────────────────────────────

  async function handleCreateSection(title: string) {
    try {
      const smartStartTime = computeSmartDefaultStartTime(
        sections || [],
        sectionedBlocks.map,
        selectedDateStr,
      )
      await createSection.mutateAsync({ title, date: selectedDateStr, startTime: smartStartTime, layout: 'sequential', sortOrder: 0 })
      toast('Section created', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create section', 'error')
    }
  }

  async function handleRenameSection(sectionId: string, title: string) {
    try {
      await updateSection.mutateAsync({ sectionId, data: { title } })
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to rename section', 'error')
    }
  }

  function handleDeleteSection(sectionId: string) {
    const section = sections?.find((s) => s.id === sectionId)
    const blockCount = sectionedBlocks.map[sectionId]?.length || 0
    setConfirmDeleteSection({ id: sectionId, title: section?.title || 'this section', blockCount })
  }

  async function executeDeleteSection() {
    if (!confirmDeleteSection) return
    try {
      await deleteSection.mutateAsync(confirmDeleteSection.id)
      toast('Section removed — blocks kept', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to remove section', 'error')
    } finally {
      setConfirmDeleteSection(null)
    }
  }

  async function handleSectionLayoutChange(sectionId: string, layout: 'sequential' | 'parallel') {
    try {
      await updateSection.mutateAsync({ sectionId, data: { layout } })
      toast(layout === 'parallel' ? 'Switched to breakout layout' : 'Switched to sequential layout', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to change layout', 'error')
    }
  }

  async function handleCreateBreakoutSection(title: string) {
    try {
      const smartStartTime = computeSmartDefaultStartTime(
        sections || [],
        sectionedBlocks.map,
        selectedDateStr,
      )
      await createSection.mutateAsync({ title, date: selectedDateStr, startTime: smartStartTime, layout: 'parallel', sortOrder: 0 })
      toast('Breakout section created', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create breakout section', 'error')
    }
  }

  // Filter blocks for the selected date (must be before drag handlers)
  const dayBlocks = useMemo(() => {
    if (!blocks) return []
    const dateKey = format(selectedDate, 'yyyy-MM-dd')
    return blocks.filter((b) => format(parseISO(b.startsAt), 'yyyy-MM-dd') === dateKey)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [blocks, selectedDate])

  // ─── Drag-and-drop ────────────────────────────────────────────────────

  // Custom collision: blocks-first, then sections as fallback.
  // This ensures dragging over a block in the same section triggers
  // SortableContext shifting (not just the section droppable zone).
  const customCollision = useCallback((args: Parameters<typeof closestCenter>[0]) => {
    const dragId = String(args.active.id)

    // If dragging a section, only consider other sortable-section items
    if (dragId.startsWith('sortable-section-')) {
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter(
          (c) => String(c.id).startsWith('sortable-section-')
        ),
      })
    }

    // Dragging a block — section-aware collision detection
    const blockContainers = args.droppableContainers.filter((c) => {
      const id = String(c.id)
      return !id.startsWith('section-') && !id.startsWith('sortable-section-')
    })
    const sectionContainers = args.droppableContainers.filter((c) =>
      String(c.id).startsWith('section-')
    )

    // Determine which section the pointer is inside
    const sectionHits = pointerWithin({ ...args, droppableContainers: sectionContainers })

    if (sectionHits.length > 0) {
      const targetSectionId = sectionHits[0].id
      const sectionRect = args.droppableRects.get(targetSectionId)

      if (sectionRect) {
        // Find blocks whose vertical center falls within this section's rect
        const blocksInSection = blockContainers.filter((c) => {
          const blockRect = args.droppableRects.get(c.id)
          if (!blockRect) return false
          const blockCenterY = blockRect.top + blockRect.height / 2
          return blockCenterY >= sectionRect.top && blockCenterY <= sectionRect.bottom
        })

        if (blocksInSection.length > 0) {
          // Section has blocks — use closestCenter among them for reordering
          return closestCenter({ ...args, droppableContainers: blocksInSection })
        }

        // Section is empty — return the section drop zone for cross-section move
        return sectionHits
      }
    }

    // Pointer not inside any section — fall back to closest block
    const blockHits = closestCenter({ ...args, droppableContainers: blockContainers })
    if (blockHits.length > 0) return blockHits

    return closestCenter(args)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = event.active.id as string
    if (id.startsWith('sortable-section-')) {
      setActiveSectionId(id.replace('sortable-section-', ''))
      setActiveBlockId(null)
      return
    }
    setActiveBlockId(id)
    setActiveSectionId(null)

    // Initialize container map + order map from current data
    const containerMap: Record<string, string> = {}
    const orderMap: Record<string, string[]> = {}

    for (const block of dayBlocks) {
      const container = block.sectionId ?? UNSECTIONED
      containerMap[block.id] = container
      if (!orderMap[container]) orderMap[container] = []
      orderMap[container].push(block.id)
    }

    setDragContainerMap(containerMap)
    setDragOrderMap(orderMap)
  }, [dayBlocks])

  /** Called continuously during drag — handles cross-container movement */
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over || !dragContainerMap || !dragOrderMap) return

    const activeId = active.id as string
    // Skip section drags
    if (activeId.startsWith('sortable-section-')) return

    const overId = over.id as string

    // Determine which container the active block is currently in
    const activeContainer = dragContainerMap[activeId]
    if (!activeContainer) return

    // Determine target container
    let overContainer: string | null = null

    if (overId.startsWith('section-')) {
      // Dropped over a section drop zone
      const sectionId = overId.replace('section-', '')
      overContainer = sectionId === 'unsectioned' ? UNSECTIONED : sectionId
    } else if (overId.startsWith('sortable-section-')) {
      // Over a sortable section wrapper — ignore (that's for section reordering)
      return
    } else {
      // Over another block — get that block's container
      overContainer = dragContainerMap[overId] ?? null
    }

    if (!overContainer || activeContainer === overContainer) {
      // Same container — reorder within (SortableContext handles the visual shift)
      return
    }

    // Moving from one container to another
    const activeItems = [...(dragOrderMap[activeContainer] || [])]
    const overItems = [...(dragOrderMap[overContainer] || [])]

    // Remove from old container
    const fromIndex = activeItems.indexOf(activeId)
    if (fromIndex >= 0) activeItems.splice(fromIndex, 1)

    // Determine insert position in new container
    let insertIndex = overItems.length
    if (!overId.startsWith('section-')) {
      // Dropped on a specific block — insert at that position
      const overIndex = overItems.indexOf(overId)
      if (overIndex >= 0) {
        insertIndex = overIndex
      }
    }

    overItems.splice(insertIndex, 0, activeId)

    setDragContainerMap((prev) => ({
      ...prev!,
      [activeId]: overContainer!,
    }))
    setDragOrderMap((prev) => ({
      ...prev!,
      [activeContainer]: activeItems,
      [overContainer!]: overItems,
    }))
  }, [dragContainerMap, dragOrderMap])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const wasDraggingSection = activeSectionId !== null
    const currentContainerMap = dragContainerMap
    const currentOrderMap = dragOrderMap

    // Always clear overlay tracking (hides the drag overlay)
    setActiveBlockId(null)
    setActiveSectionId(null)

    // Helper to clear drag maps — called on every code path
    const clearDragMaps = () => {
      setDragContainerMap(null)
      setDragOrderMap(null)
    }

    const { active, over } = event
    if (!over) { clearDragMaps(); return }

    const activeId = active.id as string
    const overId = over.id as string

    // ─── Section reorder ───────────────────────────────────────────
    if (wasDraggingSection && activeId.startsWith('sortable-section-') && overId.startsWith('sortable-section-')) {
      clearDragMaps()
      if (activeId === overId) return
      const currentSections = sections || []
      const oldIndex = currentSections.findIndex((s) => `sortable-section-${s.id}` === activeId)
      const newIndex = currentSections.findIndex((s) => `sortable-section-${s.id}` === overId)
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(currentSections, oldIndex, newIndex)
        reorderSections.mutate(reordered.map((s) => s.id))
      }
      return
    }

    // ─── Block drag logic ──────────────────────────────────────────
    if (!currentContainerMap || !currentOrderMap) { clearDragMaps(); return }

    const block = blocks?.find((b) => b.id === activeId)
    if (!block) { clearDragMaps(); return }

    const originalContainer = block.sectionId ?? UNSECTIONED
    const finalContainer = currentContainerMap[activeId] ?? originalContainer
    const finalSectionId = finalContainer === UNSECTIONED ? null : finalContainer

    // Check if container changed
    if (originalContainer !== finalContainer) {
      // Cross-section move — fire mutations first, then delay clearing drag maps
      // so sectionedBlocks keeps showing the block in the new section until
      // the mutation's optimistic update takes over in the query cache.
      assignBlock.mutate({ blockId: activeId, sectionId: finalSectionId })
      const newOrder = currentOrderMap[finalContainer]
      if (newOrder && newOrder.length > 1) {
        handleReorder(newOrder)
      }
      requestAnimationFrame(clearDragMaps)
    } else {
      // Same container — clear immediately, then compute reorder
      clearDragMaps()
      // If over target is a section zone (not a block), nothing to reorder
      if (overId.startsWith('section-') || activeId === overId) return

      const containerBlocks = dayBlocks
        .filter((b) => (b.sectionId ?? UNSECTIONED) === finalContainer)
        .sort((a, b) => a.sortOrder - b.sortOrder)

      const oldIndex = containerBlocks.findIndex((b) => b.id === activeId)
      const newIndex = containerBlocks.findIndex((b) => b.id === overId)
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(containerBlocks, oldIndex, newIndex)
        handleReorder(reordered.map((b) => b.id))
      }
    }
  }, [blocks, dayBlocks, sections, activeSectionId, assignBlock, handleReorder, reorderSections, dragContainerMap, dragOrderMap])

  const handleDragCancel = useCallback(() => {
    setActiveBlockId(null)
    setActiveSectionId(null)
    setDragContainerMap(null)
    setDragOrderMap(null)
  }, [])

  // ─── Build view data ──────────────────────────────────────────────────

  const editInitial = useMemo<Partial<DrawerFormData> | undefined>(() => {
    if (!editingBlock) return undefined
    const startsAt = parseISO(editingBlock.startsAt)
    const endsAt = parseISO(editingBlock.endsAt)
    const durationMs = endsAt.getTime() - startsAt.getTime()
    const durationMinutes = Math.max(Math.round(durationMs / 60000), 1)
    const meta = (editingBlock.metadata as Record<string, unknown>) || {}
    const customType = meta.customType as string | undefined
    // Read from servicePosition first, fall back to legacy pcoServicePosition
    const position = (meta.servicePosition || meta.pcoServicePosition || 'during') as 'pre' | 'during' | 'post'
    return {
      type: customType || editingBlock.type,
      title: editingBlock.title,
      description: editingBlock.description || '',
      durationMinutes,
      locationText: editingBlock.locationText || '',
      servicePosition: position,
    }
  }, [editingBlock])

  // Group blocks by section — uses drag state when actively dragging for visual shifting
  const sectionedBlocks = useMemo(() => {
    const map: Record<string, EventScheduleBlock[]> = {}
    const unsectioned: EventScheduleBlock[] = []

    if (dragContainerMap && dragOrderMap) {
      // During drag: use local container assignments and order
      const blockMap = new Map(dayBlocks.map((b) => [b.id, b]))

      for (const [containerId, blockIds] of Object.entries(dragOrderMap)) {
        const orderedBlocks = blockIds
          .map((id) => blockMap.get(id))
          .filter(Boolean) as EventScheduleBlock[]

        if (containerId === UNSECTIONED) {
          unsectioned.push(...orderedBlocks)
        } else {
          map[containerId] = orderedBlocks
        }
      }
    } else {
      // Not dragging: use server data
      for (const block of dayBlocks) {
        if (block.sectionId) {
          if (!map[block.sectionId]) map[block.sectionId] = []
          map[block.sectionId].push(block)
        } else {
          unsectioned.push(block)
        }
      }
    }

    return { map, unsectioned }
  }, [dayBlocks, dragContainerMap, dragOrderMap])

  // ─── Computed times map — recomputes on section/block/drag changes ───
  // Parallel sections are skipped — their blocks all share the section start time.
  const computedTimesMap = useMemo(() => {
    const combined = new Map<string, ComputedBlockTime>()
    if (!sections) return combined

    for (const section of sections) {
      if (section.layout === 'parallel') continue // parallel blocks don't use sequential time computation
      const sectionBlocks = sectionedBlocks.map[section.id] || []
      if (sectionBlocks.length === 0) continue
      const times = computeBlockTimes(section.startTime, selectedDateStr, sectionBlocks)
      for (const [id, time] of times) {
        combined.set(id, time)
      }
    }

    return combined
  }, [sections, sectionedBlocks, selectedDateStr])

  // ─── Section start time handler ─────────────────────────────────────
  async function handleSectionStartTimeChange(sectionId: string, newStartTime: string) {
    try {
      await updateSection.mutateAsync({ sectionId, data: { startTime: newStartTime } })

      // Re-sort all sections by startTime after a time change
      if (sections && sections.length > 1) {
        const updated = sections.map((s) =>
          s.id === sectionId ? { ...s, startTime: newStartTime } : s,
        )
        const sorted = [...updated].sort((a, b) => {
          const { hours: ha, minutes: ma } = parseHHMM(a.startTime)
          const { hours: hb, minutes: mb } = parseHHMM(b.startTime)
          return ha * 60 + ma - (hb * 60 + mb)
        })
        const alreadyInOrder = sorted.every((s, i) => s.id === sections[i]?.id)
        if (!alreadyInOrder) {
          reorderSections.mutate(sorted.map((s) => s.id))
        }
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update start time', 'error')
    }
  }

  const sectionSortableIds = (sections || []).map((s) => `sortable-section-${s.id}`)
  const activeBlock = activeBlockId ? dayBlocks.find((b) => b.id === activeBlockId) : null
  const activeSectionData = activeSectionId
    ? (sections || []).find((s) => s.id === activeSectionId)
    : null

  const isLoading = blocksLoading || sectionsLoading

  if (isLoading) return <ScheduleSkeleton />

  const hasSections = sections && sections.length > 0
  const hasBlocks = dayBlocks.length > 0

  return (
    <div className="space-y-5">
      {/* Day navigator + View mode toggle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Day navigator — bounded to event dates */}
        <div className="flex items-center justify-center border border-slate-300 rounded-xl p-1">
          <button
            onClick={() => canGoPrev && eventDates && setSelectedDate(eventDates[currentDateIndex - 1])}
            disabled={!canGoPrev}
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
              canGoPrev
                ? 'text-slate-500 hover:bg-slate-200 hover:text-slate-900 cursor-pointer active:scale-95'
                : 'text-slate-300 cursor-not-allowed'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="px-5 py-1 min-w-[200px] text-center">
            <h4 className="text-sm font-semibold text-slate-900">
              {format(selectedDate, 'EEEE, MMMM d')}
            </h4>
            {eventDates && eventDates.length > 1 && currentDateIndex >= 0 && (
              <p className="text-[11px] text-slate-400 mt-0.5">
                Day {currentDateIndex + 1} of {eventDates.length}
              </p>
            )}
          </div>
          <button
            onClick={() => canGoNext && eventDates && setSelectedDate(eventDates[currentDateIndex + 1])}
            disabled={!canGoNext}
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
              canGoNext
                ? 'text-slate-500 hover:bg-slate-200 hover:text-slate-900 cursor-pointer active:scale-95'
                : 'text-slate-300 cursor-not-allowed'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Order / Timeline pill toggle + Add Block */}
        <div className="flex items-center justify-center sm:justify-end gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center bg-slate-100 border border-slate-300 rounded-full p-1">
            <button
              onClick={() => setViewMode('order')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
                viewMode === 'order'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Order
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
                viewMode === 'timeline'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Timeline
            </button>
          </div>

          {/* Export */}
          {hasBlocks && (
            <button
              onClick={() => setExportDrawerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
              title="Export schedule"
            >
              <FileDown className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}

          <AddScheduleDropdown
            onAddBlock={() => openAddDrawer()}
            onAddSection={handleCreateSection}
            onAddBreakout={handleCreateBreakoutSection}
          />
        </div>
      </div>

      {/* Schedule content */}
      {!hasBlocks && !hasSections ? (
        <ScheduleEmptyState onAdd={() => openAddDrawer()} />
      ) : viewMode === 'timeline' ? (
        <ScheduleTimelineView
          blocks={dayBlocks}
          sections={sections || []}
          allTypes={allTypes}
          selectedDateStr={selectedDateStr}
          onEditBlock={openEditDrawer}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={customCollision}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          {/* Section-level sortable context (for reordering sections) */}
          <SortableContext items={sectionSortableIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {/* Render sections (sortable) */}
              {(sections || []).map((section) => {
                const sectionBlocks = sectionedBlocks.map[section.id] || []
                const sectionBlockIds = sectionBlocks.map((b) => b.id)
                const isParallel = section.layout === 'parallel'

                const totalMins = sectionBlocks.reduce((sum, b) => {
                  const s = parseISO(b.startsAt)
                  const e = parseISO(b.endsAt)
                  return sum + Math.max(Math.round((e.getTime() - s.getTime()) / 60000), 1)
                }, 0)

                // Compute time span for section header
                let timeSpan: string
                if (isParallel && sectionBlocks.length > 0) {
                  // Parallel: show section start → end of longest block
                  const maxDuration = sectionBlocks.reduce((max, b) => {
                    const s = parseISO(b.startsAt)
                    const e = parseISO(b.endsAt)
                    return Math.max(max, Math.round((e.getTime() - s.getTime()) / 60000))
                  }, 0)
                  const { hours, minutes } = parseHHMM(section.startTime)
                  const start = new Date(`${selectedDateStr}T00:00:00`)
                  start.setHours(hours, minutes, 0, 0)
                  const end = addMinutes(start, maxDuration)
                  timeSpan = `${formatDateTo12(start)} – ${formatDateTo12(end)}`
                } else if (!isParallel && sectionBlocks.length > 0) {
                  const sectionTimes = computeBlockTimes(section.startTime, selectedDateStr, sectionBlocks)
                  const lastBlockTime = sectionTimes.get(sectionBlocks[sectionBlocks.length - 1].id)
                  // Always use the section's configured startTime for the header (not pre-item times)
                  timeSpan = lastBlockTime
                    ? `${formatTime12(section.startTime)} – ${formatDateTo12(lastBlockTime.computedEnd)}`
                    : formatTime12(section.startTime)
                } else {
                  timeSpan = formatTime12(section.startTime)
                }

                // For parallel sections, show max duration instead of total sum
                const displayDuration = isParallel && sectionBlocks.length > 0
                  ? Math.max(...sectionBlocks.map((b) => {
                      const s = parseISO(b.startsAt)
                      const e = parseISO(b.endsAt)
                      return Math.round((e.getTime() - s.getTime()) / 60000)
                    }))
                  : totalMins

                return (
                  <SortableSectionCard key={section.id} section={section}>
                    {(listeners: Record<string, unknown>) => (
                      <div className="rounded-xl p-3 border bg-slate-50/50 border-slate-100">
                        <SectionHeader
                          section={section}
                          blockCount={sectionBlocks.length}
                          totalDuration={displayDuration}
                          timeSpan={timeSpan}
                          onRename={(title) => handleRenameSection(section.id, title)}
                          onStartTimeChange={(time) => handleSectionStartTimeChange(section.id, time)}
                          onLayoutChange={(layout) => handleSectionLayoutChange(section.id, layout)}
                          onDelete={() => handleDeleteSection(section.id)}
                          onAddBlock={() => openAddDrawer(section.id)}
                          onLinkPCO={() => setPcoLinkSectionId(section.id)}
                          dragListeners={listeners}
                        />
                        {/* PCO new items notification */}
                        {pcoSectionStatuses[section.id] && (
                          <button
                            onClick={() => setPcoLinkSectionId(section.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 mb-1 rounded-lg bg-indigo-50 border border-indigo-200 text-left transition-colors hover:bg-indigo-100 cursor-pointer"
                          >
                            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse flex-shrink-0" />
                            <span className="text-xs font-medium text-indigo-700 flex-1">
                              {pcoSectionStatuses[section.id].newItemCount} new item{pcoSectionStatuses[section.id].newItemCount !== 1 ? 's' : ''} in Planning Center
                              {pcoSectionStatuses[section.id].newItemTitles.length > 0 && (
                                <span className="font-normal text-indigo-500">
                                  {' — '}{pcoSectionStatuses[section.id].newItemTitles.slice(0, 3).join(', ')}
                                  {pcoSectionStatuses[section.id].newItemTitles.length > 3 && ` +${pcoSectionStatuses[section.id].newItemTitles.length - 3} more`}
                                </span>
                              )}
                            </span>
                            <span className="text-xs text-indigo-500 flex-shrink-0">Review →</span>
                          </button>
                        )}
                        <DroppableSection sectionId={section.id}>
                          {/* Per-section SortableContext — strategy depends on layout */}
                          <SortableContext items={sectionBlockIds} strategy={isParallel ? rectSortingStrategy : verticalListSortingStrategy}>
                            {sectionBlocks.length > 0 ? (
                              isParallel ? (
                                <ParallelBlockGrid
                                  blocks={sectionBlocks}
                                  allTypes={allTypes}
                                  sectionStartTime={section.startTime}
                                  onEditBlock={openEditDrawer}
                                  onDelete={handleDelete}
                                  deletingId={deletingId}
                                />
                              ) : (
                                <SectionBlockList
                                  blocks={sectionBlocks}
                                  allTypes={allTypes}
                                  computedTimes={computedTimesMap}
                                  onEditBlock={openEditDrawer}
                                  onDelete={handleDelete}
                                  deletingId={deletingId}
                                />
                              )
                            ) : (
                              <div className="py-6 text-center text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                                Drag blocks here or click + to add
                              </div>
                            )}
                          </SortableContext>
                        </DroppableSection>
                      </div>
                    )}
                  </SortableSectionCard>
                )
              })}

              {/* Unsectioned blocks */}
              {(sectionedBlocks.unsectioned.length > 0 || (hasSections && activeBlockId)) && (
                <div>
                  {hasSections && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Unsectioned</span>
                      <span className="text-xs text-slate-400">{sectionedBlocks.unsectioned.length} block{sectionedBlocks.unsectioned.length !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                  <DroppableSection sectionId="unsectioned">
                    <SortableContext items={sectionedBlocks.unsectioned.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                      {sectionedBlocks.unsectioned.length > 0 ? (
                        <SectionBlockList
                          blocks={sectionedBlocks.unsectioned}
                          allTypes={allTypes}
                          onEditBlock={openEditDrawer}
                          onDelete={handleDelete}
                          deletingId={deletingId}
                        />
                      ) : (
                        <div className="py-4 text-center text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                          Drop here to remove from section
                        </div>
                      )}
                    </SortableContext>
                  </DroppableSection>
                </div>
              )}
            </div>
          </SortableContext>

          {/* Drag overlay */}
          <DragOverlay dropAnimation={null}>
            {activeBlock ? <BlockRowOverlay block={activeBlock} allTypes={allTypes} /> : null}
            {activeSectionData ? (
              <div className="bg-slate-100 rounded-xl p-3 border border-slate-200 shadow-lg opacity-90">
                <div className="flex items-center gap-2.5">
                  <GripVertical className="w-4 h-4 text-slate-400" />
                  <FolderOpen className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-900">{activeSectionData.title}</span>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Add / Edit Block Drawer */}
      <AddBlockDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setEditingBlock(null)
          setAddToSectionId(null)
        }}
        onSubmit={editingBlock ? handleUpdate : handleCreate}
        isSubmitting={editingBlock ? updateBlock.isPending : createBlock.isPending}
        allTypes={allTypes}
        onAddCustomType={handleAddCustomType}
        initialData={editInitial}
        submitLabel={editingBlock ? 'Save Changes' : 'Save Item'}
        eventProjectId={eventProjectId}
        blockId={editingBlock?.id ?? null}
      />

      {/* Export Schedule Drawer */}
      <ExportScheduleDrawer
        isOpen={exportDrawerOpen}
        onClose={() => setExportDrawerOpen(false)}
        eventProjectId={eventProjectId}
        allBlocks={blocks || []}
        allTypes={allTypes}
        eventDates={eventDates}
        selectedDateStr={selectedDateStr}
      />

      {/* Planning Center Link Modal */}
      {pcoLinkSectionId && (
        <PCOServiceLinkModal
          eventProjectId={eventProjectId}
          sectionId={pcoLinkSectionId}
          sectionTitle={sections?.find((s) => s.id === pcoLinkSectionId)?.title || 'Section'}
          onClose={() => {
            // Dismiss the PCO notification for this section
            setPcoSectionStatuses((prev) => {
              const next = { ...prev }
              delete next[pcoLinkSectionId]
              return next
            })
            setPcoLinkSectionId(null)
          }}
        />
      )}

      {/* Delete Block Confirmation */}
      <ConfirmDialog
        isOpen={!!confirmDeleteBlock}
        onClose={() => setConfirmDeleteBlock(null)}
        onConfirm={executeDeleteBlock}
        title="Delete Item"
        message={`Are you sure you want to delete "${confirmDeleteBlock?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        isLoading={!!deletingId}
        loadingText="Deleting..."
      />

      {/* Delete Section Confirmation */}
      <ConfirmDialog
        isOpen={!!confirmDeleteSection}
        onClose={() => setConfirmDeleteSection(null)}
        onConfirm={executeDeleteSection}
        title="Delete Section"
        message={`Are you sure you want to delete "${confirmDeleteSection?.title}"?${confirmDeleteSection?.blockCount ? ` The ${confirmDeleteSection.blockCount} item${confirmDeleteSection.blockCount !== 1 ? 's' : ''} inside will be kept as unsectioned.` : ''}`}
        confirmText="Delete Section"
        variant="danger"
        isLoading={deleteSection.isPending}
        loadingText="Deleting..."
      />
    </div>
  )
}
