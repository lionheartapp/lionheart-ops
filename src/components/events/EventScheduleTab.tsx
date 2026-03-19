'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, parseISO, addMinutes, addDays, subDays } from 'date-fns'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
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
  X,
} from 'lucide-react'
import DetailDrawer from '@/components/DetailDrawer'
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
  type EventScheduleSection,
} from '@/lib/hooks/useEventSchedule'
import { type EventScheduleBlock } from '@/lib/hooks/useEventProject'
import { useToast } from '@/components/Toast'
import type { CreateScheduleBlockInput, UpdateScheduleBlockInput } from '@/lib/types/event-project'

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

interface BlockTypeConfig {
  value: string
  label: string
  dotColor: string
  color: string
  bg: string
  isCustom?: boolean
  hexColor?: string
}

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
      <h3 className="text-base font-semibold text-slate-900 mb-2">No schedule blocks yet</h3>
      <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
        Build your event schedule by adding time blocks for sessions, activities, meals, and more.
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
}

const defaultDrawerForm: DrawerFormData = {
  type: 'SESSION',
  title: '',
  description: '',
  durationMinutes: 30,
  locationText: '',
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
}

function AddBlockDrawer({
  open,
  onClose,
  onSubmit,
  isSubmitting,
  allTypes,
  onAddCustomType,
  initialData,
  submitLabel = 'Save Block',
}: AddBlockDrawerProps) {
  const [form, setForm] = useState<DrawerFormData>({ ...defaultDrawerForm, ...initialData })
  const [errors, setErrors] = useState<Partial<Record<keyof DrawerFormData, string>>>({})
  const [showCreateType, setShowCreateType] = useState(false)
  const [newTypeLabel, setNewTypeLabel] = useState('')
  const [newTypeColor, setNewTypeColor] = useState(TYPE_COLORS[0].value)
  const [customDuration, setCustomDuration] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  // Reset form when drawer opens
  useEffect(() => {
    if (open) {
      setForm({ ...defaultDrawerForm, ...initialData })
      setErrors({})
      setShowCreateType(false)
      setNewTypeLabel('')
      setNewTypeColor(TYPE_COLORS[0].value)
      setCustomDuration('')
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

  const drawerTitle = initialData?.title ? 'Edit Block' : 'Add Block'
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
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
        {/* Block title */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Block title</label>
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
    </DetailDrawer>
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

  return (
    <>
      {/* Category dot */}
      <div className="flex-shrink-0">
        {typeConfig.hexColor ? (
          <span className="block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: typeConfig.hexColor }} />
        ) : (
          <span className={`block w-2.5 h-2.5 rounded-full ${typeConfig.dotColor}`} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-900 truncate">{block.title}</span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {block.locationText && (
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <MapPin className="w-3 h-3" />
              <span className="truncate max-w-[120px]">{block.locationText}</span>
            </div>
          )}
          {block.lead && (
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <User className="w-3 h-3" />
              <span className="truncate max-w-[100px]">
                {block.lead.firstName
                  ? `${block.lead.firstName} ${block.lead.lastName || ''}`.trim()
                  : block.lead.email}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Duration pill */}
      {!isOverlay && (
        <div className="flex-shrink-0 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-100">
          <span className="text-xs font-medium text-slate-500">{formatDuration(durationMins)}</span>
        </div>
      )}

      {/* Auto-calculated time range */}
      {!isOverlay && timeRange && (
        <div className="flex-shrink-0 flex items-center gap-1.5 text-xs text-slate-500 min-w-[130px] justify-end">
          <Clock className="w-3 h-3 text-slate-400" />
          {timeRange}
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
  onDelete: (blockId: string) => Promise<void>
  isDeleting?: boolean
  /** Column offset index for concurrent blocks (0 = no offset) */
  concurrentOffset?: number
  concurrentTotal?: number
}

function SortableBlockRow({
  block,
  allTypes,
  durationMins,
  timeRange,
  onEdit,
  onDelete,
  isDeleting,
  concurrentOffset = 0,
  concurrentTotal = 1,
}: SortableBlockRowProps) {
  const [isHovered, setIsHovered] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
    position: 'relative' as const,
  }

  // If this block is part of a concurrent group, adjust width
  if (concurrentTotal > 1) {
    const widthPct = Math.floor(100 / concurrentTotal)
    style.width = `${widthPct}%`
    style.display = 'inline-flex'
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative flex items-center gap-3 px-3 py-3 bg-white border rounded-xl transition-all cursor-default ${
        isDragging ? 'border-indigo-300 shadow-lg ring-2 ring-indigo-100' : 'border-slate-200/80 hover:border-slate-300 hover:shadow-sm'
      }`}
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

      {/* Hover actions */}
      <div className={`flex items-center gap-2 transition-opacity ${isHovered && !isDragging ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
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

// ─── Section Header (editable inline) ────────────────────────────────────────

interface SectionHeaderProps {
  section: EventScheduleSection
  blockCount: number
  totalDuration: number
  onRename: (newTitle: string) => void
  onDelete: () => void
  onAddBlock: () => void
}

function SectionHeader({ section, blockCount, totalDuration, onRename, onDelete, onAddBlock }: SectionHeaderProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(section.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  function handleSave() {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== section.title) {
      onRename(trimmed)
    } else {
      setEditValue(section.title)
    }
    setIsEditing(false)
  }

  return (
    <div className="flex items-center justify-between mb-2 group/header">
      <div className="flex items-center gap-2.5">
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
        <span className="text-xs text-slate-400">
          {blockCount} block{blockCount !== 1 ? 's' : ''}
          {totalDuration > 0 && ` · ${formatDuration(totalDuration)}`}
        </span>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover/header:opacity-100 transition-opacity">
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
          title="Delete section (blocks are kept)"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Concurrent Time Slot Grouping ───────────────────────────────────────────

interface TimeSlotGroup {
  blocks: EventScheduleBlock[]
  startTime: Date
  endTime: Date
}

/** Group blocks that overlap in time into concurrent groups */
function groupConcurrentBlocks(blocks: EventScheduleBlock[]): TimeSlotGroup[] {
  if (blocks.length === 0) return []

  const sorted = [...blocks].sort((a, b) =>
    new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  )

  const groups: TimeSlotGroup[] = []
  let currentGroup: TimeSlotGroup = {
    blocks: [sorted[0]],
    startTime: parseISO(sorted[0].startsAt),
    endTime: parseISO(sorted[0].endsAt),
  }

  for (let i = 1; i < sorted.length; i++) {
    const block = sorted[i]
    const blockStart = parseISO(block.startsAt)
    const blockEnd = parseISO(block.endsAt)

    // If this block starts before the current group ends, it's concurrent
    if (blockStart.getTime() < currentGroup.endTime.getTime()) {
      currentGroup.blocks.push(block)
      if (blockEnd.getTime() > currentGroup.endTime.getTime()) {
        currentGroup.endTime = blockEnd
      }
    } else {
      groups.push(currentGroup)
      currentGroup = { blocks: [block], startTime: blockStart, endTime: blockEnd }
    }
  }
  groups.push(currentGroup)

  return groups
}

// ─── Section Block List ─────────────────────────────────────────────────────

interface SectionBlockListProps {
  blocks: EventScheduleBlock[]
  allTypes: BlockTypeConfig[]
  onEditBlock: (block: EventScheduleBlock) => void
  onDelete: (blockId: string) => Promise<void>
  deletingId: string | null
}

function SectionBlockList({ blocks, allTypes, onEditBlock, onDelete, deletingId }: SectionBlockListProps) {
  const timeGroups = useMemo(() => groupConcurrentBlocks(blocks), [blocks])

  return (
    <div className="space-y-1.5">
      {timeGroups.map((group, gi) => {
        const isConcurrent = group.blocks.length > 1

        if (isConcurrent) {
          // Side-by-side layout for concurrent blocks
          return (
            <div key={`group-${gi}`} className="flex gap-2">
              {group.blocks.map((block) => {
                const startsAt = parseISO(block.startsAt)
                const endsAt = parseISO(block.endsAt)
                const durationMins = Math.max(Math.round((endsAt.getTime() - startsAt.getTime()) / 60000), 1)
                const timeRange = `${format(startsAt, 'h:mm a')} – ${format(endsAt, 'h:mm a')}`

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
                    concurrentOffset={group.blocks.indexOf(block)}
                    concurrentTotal={group.blocks.length}
                  />
                )
              })}
            </div>
          )
        }

        // Single block — normal row
        const block = group.blocks[0]
        const startsAt = parseISO(block.startsAt)
        const endsAt = parseISO(block.endsAt)
        const durationMins = Math.max(Math.round((endsAt.getTime() - startsAt.getTime()) / 60000), 1)
        const timeRange = `${format(startsAt, 'h:mm a')} – ${format(endsAt, 'h:mm a')}`

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

// ─── Add Section Inline ─────────────────────────────────────────────────────

function AddSectionButton({ onAdd }: { onAdd: (title: string) => void }) {
  const [isAdding, setIsAdding] = useState(false)
  const [title, setTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isAdding])

  function handleSubmit() {
    const trimmed = title.trim()
    if (trimmed) {
      onAdd(trimmed)
      setTitle('')
      setIsAdding(false)
    }
  }

  if (isAdding) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit()
            if (e.key === 'Escape') { setTitle(''); setIsAdding(false) }
          }}
          placeholder="Section name..."
          className="flex-1 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-all"
        />
        <button
          onClick={handleSubmit}
          disabled={!title.trim()}
          className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-40 transition-all cursor-pointer"
        >
          Add
        </button>
        <button
          onClick={() => { setTitle(''); setIsAdding(false) }}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setIsAdding(true)}
      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-dashed border-slate-300 text-xs font-medium text-slate-500 hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
    >
      <Plus className="w-3.5 h-3.5" />
      Add Section
    </button>
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
  const { data: blocks, isLoading: blocksLoading } = useScheduleBlocks(eventProjectId)
  const { data: sections, isLoading: sectionsLoading } = useScheduleSections(eventProjectId)
  const createBlock = useCreateScheduleBlock(eventProjectId)
  const updateBlock = useUpdateScheduleBlock(eventProjectId)
  const deleteBlock = useDeleteScheduleBlock(eventProjectId)
  const reorderBlocks = useReorderScheduleBlocks(eventProjectId)
  const createSection = useCreateScheduleSection(eventProjectId)
  const updateSection = useUpdateScheduleSection(eventProjectId)
  const deleteSection = useDeleteScheduleSection(eventProjectId)
  const assignBlock = useAssignBlockToSection(eventProjectId)
  const { toast } = useToast()

  const [viewMode, setViewMode] = useState<'order' | 'timeline'>('order')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingBlock, setEditingBlock] = useState<EventScheduleBlock | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [addToSectionId, setAddToSectionId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (defaultDate) return new Date(defaultDate + 'T00:00:00')
    return new Date(format(new Date(), 'yyyy-MM-dd') + 'T00:00:00')
  })
  const [customTypes, setCustomTypes] = useState<BlockTypeConfig[]>(() => loadCustomTypes(eventProjectId))
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null)

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

  const canGoPrev = eventDates ? currentDateIndex > 0 : true
  const canGoNext = eventDates ? currentDateIndex < eventDates.length - 1 : true

  const allTypes = useMemo(() => getAllBlockTypes(eventProjectId, customTypes), [eventProjectId, customTypes])

  function handleAddCustomType(type: BlockTypeConfig) {
    const updated = [...customTypes, type]
    setCustomTypes(updated)
    saveCustomTypes(eventProjectId, updated)
  }

  function getDateStr(): string {
    return format(selectedDate, 'yyyy-MM-dd')
  }

  // ─── Block CRUD ───────────────────────────────────────────────────────

  async function handleCreate(data: DrawerFormData) {
    const dateStr = getDateStr()
    // Default to 8am start; the actual time is mostly a label since blocks are label-only sections
    const startsAt = new Date(`${dateStr}T08:00:00`)
    const endsAt = addMinutes(startsAt, data.durationMinutes)

    const isCustomType = !VALID_API_TYPES.includes(data.type as ApiBlockType)
    const payload: CreateScheduleBlockInput = {
      type: toApiType(data.type),
      title: data.title,
      description: data.description || undefined,
      startsAt,
      endsAt,
      locationText: data.locationText || undefined,
      sectionId: addToSectionId ?? undefined,
      sortOrder: blocks?.length ?? 0,
      ...(isCustomType ? { metadata: { customType: data.type } } : {}),
    }
    try {
      await createBlock.mutateAsync(payload)
      toast('Schedule block added', 'success')
      setDrawerOpen(false)
      setAddToSectionId(null)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to add block', 'error')
    }
  }

  async function handleUpdate(data: DrawerFormData) {
    if (!editingBlock) return
    const dateStr = getDateStr()
    const startsAt = parseISO(editingBlock.startsAt)
    const endsAt = addMinutes(startsAt, data.durationMinutes)

    const isCustomType = !VALID_API_TYPES.includes(data.type as ApiBlockType)
    const updateData: UpdateScheduleBlockInput = {
      type: toApiType(data.type),
      title: data.title,
      description: data.description || undefined,
      startsAt,
      endsAt,
      locationText: data.locationText || undefined,
      ...(isCustomType ? { metadata: { customType: data.type } } : { metadata: null }),
    }
    try {
      await updateBlock.mutateAsync({ blockId: editingBlock.id, data: updateData })
      toast('Block updated', 'success')
      setEditingBlock(null)
      setDrawerOpen(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update block', 'error')
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
      await createSection.mutateAsync({ title })
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

  async function handleDeleteSection(sectionId: string) {
    try {
      await deleteSection.mutateAsync(sectionId)
      toast('Section removed — blocks kept', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to remove section', 'error')
    }
  }

  // ─── Drag-and-drop ────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveBlockId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveBlockId(null)
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    // Check if dropped onto a section drop zone
    if (overId.startsWith('section-')) {
      const targetSectionId = overId.replace('section-', '')
      const block = blocks?.find((b) => b.id === activeId)
      if (block && block.sectionId !== targetSectionId) {
        assignBlock.mutate({ blockId: activeId, sectionId: targetSectionId })
      }
      return
    }

    // Check if dropped on the unsectioned zone
    if (overId === 'section-unsectioned') {
      const block = blocks?.find((b) => b.id === activeId)
      if (block && block.sectionId) {
        assignBlock.mutate({ blockId: activeId, sectionId: null })
      }
      return
    }

    // Otherwise, it's a reorder within the same list
    if (activeId === overId) return

    // Find both blocks and check if they're in the same section
    const activeBlock = blocks?.find((b) => b.id === activeId)
    const overBlock = blocks?.find((b) => b.id === overId)
    if (!activeBlock || !overBlock) return

    if (activeBlock.sectionId === overBlock.sectionId) {
      // Reorder within section
      const sectionBlocks = (blocks || [])
        .filter((b) => b.sectionId === activeBlock.sectionId)
        .sort((a, b) => a.sortOrder - b.sortOrder)

      const oldIndex = sectionBlocks.findIndex((b) => b.id === activeId)
      const newIndex = sectionBlocks.findIndex((b) => b.id === overId)
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(sectionBlocks, oldIndex, newIndex)
        handleReorder(reordered.map((b) => b.id))
      }
    } else {
      // Dragged from one section to another — assign to the target section
      assignBlock.mutate({ blockId: activeId, sectionId: overBlock.sectionId })
    }
  }, [blocks, assignBlock, handleReorder])

  const handleDragCancel = useCallback(() => {
    setActiveBlockId(null)
  }, [])

  // ─── Build view data ──────────────────────────────────────────────────

  const editInitial = useMemo<Partial<DrawerFormData> | undefined>(() => {
    if (!editingBlock) return undefined
    const startsAt = parseISO(editingBlock.startsAt)
    const endsAt = parseISO(editingBlock.endsAt)
    const durationMs = endsAt.getTime() - startsAt.getTime()
    const durationMinutes = Math.max(Math.round(durationMs / 60000), 1)
    const customType = (editingBlock.metadata as Record<string, unknown>)?.customType as string | undefined
    return {
      type: customType || editingBlock.type,
      title: editingBlock.title,
      description: editingBlock.description || '',
      durationMinutes,
      locationText: editingBlock.locationText || '',
    }
  }, [editingBlock])

  // Filter blocks for the selected date
  const dayBlocks = useMemo(() => {
    if (!blocks) return []
    const dateKey = format(selectedDate, 'yyyy-MM-dd')
    return blocks.filter((b) => format(parseISO(b.startsAt), 'yyyy-MM-dd') === dateKey)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [blocks, selectedDate])

  // Group blocks by section
  const sectionedBlocks = useMemo(() => {
    const map: Record<string, EventScheduleBlock[]> = {}
    const unsectioned: EventScheduleBlock[] = []

    for (const block of dayBlocks) {
      if (block.sectionId) {
        if (!map[block.sectionId]) map[block.sectionId] = []
        map[block.sectionId].push(block)
      } else {
        unsectioned.push(block)
      }
    }

    return { map, unsectioned }
  }, [dayBlocks])

  const allBlockIds = dayBlocks.map((b) => b.id)
  const activeBlock = activeBlockId ? dayBlocks.find((b) => b.id === activeBlockId) : null

  const isLoading = blocksLoading || sectionsLoading

  if (isLoading) return <ScheduleSkeleton />

  const hasSections = sections && sections.length > 0
  const hasBlocks = dayBlocks.length > 0

  return (
    <div className="space-y-5">
      {/* Day navigator + View mode toggle */}
      <div className="flex items-center justify-between">
        {/* Day navigator — bounded to event dates */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => canGoPrev && setSelectedDate((d) => subDays(d, 1))}
            disabled={!canGoPrev}
            className={`flex items-center justify-center w-9 h-9 rounded-lg border transition-all ${
              canGoPrev
                ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 cursor-pointer'
                : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="px-4 py-2 min-w-[200px] text-center">
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
            onClick={() => canGoNext && setSelectedDate((d) => addDays(d, 1))}
            disabled={!canGoNext}
            className={`flex items-center justify-center w-9 h-9 rounded-lg border transition-all ${
              canGoNext
                ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 cursor-pointer'
                : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Order / Timeline pill toggle + Add Block */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 rounded-full p-1">
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

          <button
            onClick={() => openAddDrawer()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Block
          </button>
        </div>
      </div>

      {/* Schedule content */}
      {!hasBlocks && !hasSections ? (
        <ScheduleEmptyState onAdd={() => openAddDrawer()} />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={allBlockIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {/* Render sections */}
              {(sections || []).map((section) => {
                const sectionBlocks = sectionedBlocks.map[section.id] || []
                const totalMins = sectionBlocks.reduce((sum, b) => {
                  const s = parseISO(b.startsAt)
                  const e = parseISO(b.endsAt)
                  return sum + Math.max(Math.round((e.getTime() - s.getTime()) / 60000), 1)
                }, 0)

                return (
                  <div key={section.id} className="bg-slate-50/50 rounded-xl p-3 border border-slate-100">
                    <SectionHeader
                      section={section}
                      blockCount={sectionBlocks.length}
                      totalDuration={totalMins}
                      onRename={(title) => handleRenameSection(section.id, title)}
                      onDelete={() => handleDeleteSection(section.id)}
                      onAddBlock={() => openAddDrawer(section.id)}
                    />
                    <DroppableSection sectionId={section.id}>
                      {sectionBlocks.length > 0 ? (
                        <SectionBlockList
                          blocks={sectionBlocks}
                          allTypes={allTypes}
                          onEditBlock={openEditDrawer}
                          onDelete={handleDelete}
                          deletingId={deletingId}
                        />
                      ) : (
                        <div className="py-6 text-center text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                          Drag blocks here or click + to add
                        </div>
                      )}
                    </DroppableSection>
                  </div>
                )
              })}

              {/* Unsectioned blocks */}
              {sectionedBlocks.unsectioned.length > 0 && (
                <div>
                  {hasSections && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Unsectioned</span>
                      <span className="text-xs text-slate-400">{sectionedBlocks.unsectioned.length} block{sectionedBlocks.unsectioned.length !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                  <DroppableSection sectionId="unsectioned">
                    <SectionBlockList
                      blocks={sectionedBlocks.unsectioned}
                      allTypes={allTypes}
                      onEditBlock={openEditDrawer}
                      onDelete={handleDelete}
                      deletingId={deletingId}
                    />
                  </DroppableSection>
                </div>
              )}
            </div>
          </SortableContext>

          {/* Drag overlay */}
          <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
            {activeBlock ? <BlockRowOverlay block={activeBlock} allTypes={allTypes} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Add Section button */}
      <div className="pt-1">
        <AddSectionButton onAdd={handleCreateSection} />
      </div>

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
        submitLabel={editingBlock ? 'Save Changes' : 'Save Block'}
      />
    </div>
  )
}
