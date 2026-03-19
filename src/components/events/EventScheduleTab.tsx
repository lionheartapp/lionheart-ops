'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
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
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers'
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
  Sunrise,
  Sunset,
  Sun,
} from 'lucide-react'
import DetailDrawer from '@/components/DetailDrawer'
import { staggerContainer, listItem, fadeInUp } from '@/lib/animations'
import {
  useScheduleBlocks,
  useCreateScheduleBlock,
  useUpdateScheduleBlock,
  useDeleteScheduleBlock,
  useReorderScheduleBlocks,
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

/** Classify a Date into Morning / Afternoon / Evening */
function getTimeOfDay(date: Date): 'morning' | 'afternoon' | 'evening' {
  const h = date.getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

const TIME_OF_DAY_CONFIG = {
  morning: { label: 'Morning', icon: Sunrise, accent: 'text-amber-600', defaultStartHour: 8 },
  afternoon: { label: 'Afternoon', icon: Sun, accent: 'text-orange-500', defaultStartHour: 12 },
  evening: { label: 'Evening', icon: Sunset, accent: 'text-indigo-500', defaultStartHour: 17 },
}

const SECTIONS = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
] as const

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
  section: 'morning' | 'afternoon' | 'evening'
  durationMinutes: number
  locationText: string
}

const defaultDrawerForm: DrawerFormData = {
  type: 'SESSION',
  title: '',
  description: '',
  section: 'morning',
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
  const [sectionOpen, setSectionOpen] = useState(false)
  const [customDuration, setCustomDuration] = useState('')
  const sectionRef = useRef<HTMLDivElement>(null)
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

  // Close section dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sectionRef.current && !sectionRef.current.contains(e.target as Node)) {
        setSectionOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

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
  const customTypes = allTypes.filter((t) => t.isCustom)

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
          {customTypes.length > 0 && (
            <>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Custom</div>
              <div className="flex flex-wrap gap-2 mb-3">
                {customTypes.map((t) => {
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

        {/* Section */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Section</label>
          <div ref={sectionRef} className="relative">
            <button
              type="button"
              onClick={() => setSectionOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm bg-white border border-slate-200 rounded-xl hover:border-slate-300 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all cursor-pointer"
            >
              <span className="text-slate-900">
                {SECTIONS.find((s) => s.value === form.section)?.label ?? 'Morning'}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${sectionOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {sectionOpen && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                {SECTIONS.map((s) => {
                  const cfg = TIME_OF_DAY_CONFIG[s.value]
                  const SectionIcon = cfg.icon
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => {
                        update('section', s.value)
                        setSectionOpen(false)
                      }}
                      className={`w-full flex items-center gap-2.5 px-4 py-3 text-sm transition-colors cursor-pointer ${
                        form.section === s.value
                          ? 'bg-slate-50 text-slate-900 font-medium'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <SectionIcon className={`w-4 h-4 ${cfg.accent}`} />
                      {s.label}
                    </button>
                  )
                })}
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

// ─── Sortable Block Row ─────────────────────────────────────────────────────

interface SortableBlockRowProps {
  block: EventScheduleBlock
  allTypes: BlockTypeConfig[]
  calculatedStart: string
  calculatedEnd: string
  durationMins: number
  onEdit: (block: EventScheduleBlock) => void
  onDelete: (blockId: string) => Promise<void>
  isDeleting?: boolean
}

function SortableBlockRow({
  block,
  allTypes,
  calculatedStart,
  calculatedEnd,
  durationMins,
  onEdit,
  onDelete,
  isDeleting,
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

  // Check metadata for custom type
  const displayType = (block.metadata as Record<string, unknown>)?.customType as string | undefined
  const typeConfig = getBlockTypeConfig(displayType || block.type, allTypes)
  const timeRange = `${calculatedStart} – ${calculatedEnd}`

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
      {/* Drag handle — larger touch target */}
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 p-1.5 -m-1.5 rounded-lg opacity-40 group-hover:opacity-70 hover:bg-slate-100 transition-all cursor-grab active:cursor-grabbing"
        role="button"
        aria-label={`Reorder ${block.title}`}
      >
        <GripVertical className="w-4 h-4 text-slate-400" />
      </div>

      {/* Category dot */}
      <div className="flex-shrink-0">
        {typeConfig.hexColor ? (
          <span className="block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: typeConfig.hexColor }} />
        ) : (
          <span className={`block w-2.5 h-2.5 rounded-full ${typeConfig.dotColor}`} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex items-center gap-4">
        {/* Title + metadata */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-900 truncate">{block.title}</span>
            {block.description && (
              <span className="hidden sm:inline text-xs text-slate-400 truncate max-w-[200px]">
                — {block.description}
              </span>
            )}
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
        <div className="flex-shrink-0 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-100">
          <span className="text-xs font-medium text-slate-500">{formatDuration(durationMins)}</span>
        </div>

        {/* Auto-calculated time range */}
        <div className="flex-shrink-0 flex items-center gap-1.5 text-xs text-slate-500 min-w-[140px] justify-end">
          <Clock className="w-3 h-3 text-slate-400" />
          {timeRange}
        </div>
      </div>

      {/* Hover actions — Edit / Delete buttons */}
      <div className={`flex items-center gap-2 transition-opacity ${isHovered && !isDragging ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <button
          onClick={() => onEdit(block)}
          className="px-4 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(block.id)}
          disabled={isDeleting}
          className="px-4 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-red-500 hover:bg-red-50 hover:border-red-200 transition-all cursor-pointer disabled:opacity-60"
        >
          {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
        </button>
      </div>
    </div>
  )
}

// ─── Drag Overlay Preview ────────────────────────────────────────────────────

function BlockRowOverlay({ block, allTypes }: { block: EventScheduleBlock; allTypes: BlockTypeConfig[] }) {
  const displayType = (block.metadata as Record<string, unknown>)?.customType as string | undefined
  const typeConfig = getBlockTypeConfig(displayType || block.type, allTypes)

  return (
    <div className="flex items-center gap-3 px-3 py-3 bg-white border-2 border-indigo-300 rounded-xl shadow-xl ring-4 ring-indigo-50 cursor-grabbing max-w-[600px]">
      <div className="flex-shrink-0 p-1.5">
        <GripVertical className="w-4 h-4 text-indigo-400" />
      </div>
      <div className="flex-shrink-0">
        {typeConfig.hexColor ? (
          <span className="block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: typeConfig.hexColor }} />
        ) : (
          <span className={`block w-2.5 h-2.5 rounded-full ${typeConfig.dotColor}`} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-slate-900 truncate">{block.title}</span>
        {block.locationText && (
          <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
            <MapPin className="w-3 h-3" />
            <span className="truncate">{block.locationText}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Section Component ───────────────────────────────────────────────────────

interface ScheduleSectionProps {
  period: 'morning' | 'afternoon' | 'evening'
  blocks: EventScheduleBlock[]
  allTypes: BlockTypeConfig[]
  sectionStartTime: Date
  onEditBlock: (block: EventScheduleBlock) => void
  onDelete: (blockId: string) => Promise<void>
  onReorder: (blockIds: string[]) => void
  deletingId: string | null
}

function ScheduleSection({
  period,
  blocks,
  allTypes,
  sectionStartTime,
  onEditBlock,
  onDelete,
  onReorder,
  deletingId,
}: ScheduleSectionProps) {
  const config = TIME_OF_DAY_CONFIG[period]
  const Icon = config.icon
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Calculate auto-stacked times for each block
  const blockTimings = useMemo(() => {
    const timings: { start: Date; end: Date; durationMins: number }[] = []
    let cursor = sectionStartTime

    for (const block of blocks) {
      const startsAt = parseISO(block.startsAt)
      const endsAt = parseISO(block.endsAt)
      // Calculate duration from stored times
      const durationMs = endsAt.getTime() - startsAt.getTime()
      const durationMins = Math.max(Math.round(durationMs / 60000), 1)

      const start = cursor
      const end = addMinutes(cursor, durationMins)
      timings.push({ start, end, durationMins })
      cursor = end
    }
    return timings
  }, [blocks, sectionStartTime])

  const totalMins = blockTimings.reduce((sum, t) => sum + t.durationMins, 0)

  const sectionStartStr = format(sectionStartTime, 'h:mm a')
  const sectionEndStr = totalMins > 0 ? format(addMinutes(sectionStartTime, totalMins), 'h:mm a') : sectionStartStr

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveBlockId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveBlockId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = blocks.findIndex((b) => b.id === active.id)
    const newIndex = blocks.findIndex((b) => b.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(blocks, oldIndex, newIndex)
    onReorder(reordered.map((b) => b.id))
  }, [blocks, onReorder])

  const handleDragCancel = useCallback(() => {
    setActiveBlockId(null)
  }, [])

  const blockIds = blocks.map((b) => b.id)
  const activeBlock = activeBlockId ? blocks.find((b) => b.id === activeBlockId) : null

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${config.accent}`} />
          <h4 className="text-sm font-semibold text-slate-900">{config.label}</h4>
          <span className="text-xs text-slate-400">
            {blocks.length} block{blocks.length !== 1 ? 's' : ''} · {formatDuration(totalMins)}
          </span>
          {blocks.length > 0 && (
            <span className="text-[10px] text-slate-400 font-medium ml-1">
              {sectionStartStr} → {sectionEndStr}
            </span>
          )}
        </div>
      </div>

      {/* Sortable block list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      >
        <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {blocks.map((block, i) => {
              const timing = blockTimings[i]
              return (
                <SortableBlockRow
                  key={block.id}
                  block={block}
                  allTypes={allTypes}
                  calculatedStart={timing ? format(timing.start, 'h:mm a') : ''}
                  calculatedEnd={timing ? format(timing.end, 'h:mm a') : ''}
                  durationMins={timing?.durationMins ?? 0}
                  onEdit={onEditBlock}
                  onDelete={onDelete}
                  isDeleting={deletingId === block.id}
                />
              )
            })}
          </div>
        </SortableContext>

        {/* Drag overlay — renders outside the sortable flow for smooth dragging */}
        <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
          {activeBlock ? <BlockRowOverlay block={activeBlock} allTypes={allTypes} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
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
  const reorderBlocks = useReorderScheduleBlocks(eventProjectId)
  const { toast } = useToast()

  const [viewMode, setViewMode] = useState<'order' | 'timeline'>('order')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingBlock, setEditingBlock] = useState<EventScheduleBlock | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [drawerSection, setDrawerSection] = useState<'morning' | 'afternoon' | 'evening'>('morning')
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (defaultDate) return new Date(defaultDate + 'T00:00:00')
    return new Date(format(new Date(), 'yyyy-MM-dd') + 'T00:00:00')
  })
  const [customTypes, setCustomTypes] = useState<BlockTypeConfig[]>(() => loadCustomTypes(eventProjectId))

  const allTypes = useMemo(() => getAllBlockTypes(eventProjectId, customTypes), [eventProjectId, customTypes])

  function handleAddCustomType(type: BlockTypeConfig) {
    const updated = [...customTypes, type]
    setCustomTypes(updated)
    saveCustomTypes(eventProjectId, updated)
  }

  /** Use the currently selected date for block creation. */
  function getDateStr(): string {
    return format(selectedDate, 'yyyy-MM-dd')
  }

  /** Build a section start time as a Date. */
  function getSectionStartTime(
    section: 'morning' | 'afternoon' | 'evening',
    dateStr: string,
    periodBlocks: EventScheduleBlock[]
  ): Date {
    // Section defaults
    const defaultHour = TIME_OF_DAY_CONFIG[section].defaultStartHour
    return new Date(`${dateStr}T${String(defaultHour).padStart(2, '0')}:00:00`)
  }

  async function handleCreate(data: DrawerFormData) {
    const dateStr = getDateStr()
    const defaultHour = TIME_OF_DAY_CONFIG[data.section].defaultStartHour
    // Start time = section default start (blocks stack sequentially on the server,
    // but we still need valid startsAt/endsAt for the API)
    const startsAt = new Date(`${dateStr}T${String(defaultHour).padStart(2, '0')}:00:00`)
    const endsAt = addMinutes(startsAt, data.durationMinutes)

    const isCustomType = !VALID_API_TYPES.includes(data.type as ApiBlockType)
    const payload: CreateScheduleBlockInput = {
      type: toApiType(data.type),
      title: data.title,
      description: data.description || undefined,
      startsAt,
      endsAt,
      locationText: data.locationText || undefined,
      sortOrder: blocks?.length ?? 0,
      ...(isCustomType ? { metadata: { customType: data.type } } : {}),
    }
    try {
      await createBlock.mutateAsync(payload)
      toast('Schedule block added', 'success')
      setDrawerOpen(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to add block', 'error')
    }
  }

  async function handleUpdate(data: DrawerFormData) {
    if (!editingBlock) return
    const dateStr = getDateStr()
    const defaultHour = TIME_OF_DAY_CONFIG[data.section].defaultStartHour
    const startsAt = new Date(`${dateStr}T${String(defaultHour).padStart(2, '0')}:00:00`)
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

  function openAddDrawer(section?: 'morning' | 'afternoon' | 'evening') {
    setEditingBlock(null)
    if (section) setDrawerSection(section)
    setDrawerOpen(true)
  }

  function openEditDrawer(block: EventScheduleBlock) {
    setEditingBlock(block)
    setDrawerOpen(true)
  }

  // Build initial form data for editing
  const editInitial = useMemo<Partial<DrawerFormData> | undefined>(() => {
    if (!editingBlock) return { section: drawerSection }
    const startsAt = parseISO(editingBlock.startsAt)
    const endsAt = parseISO(editingBlock.endsAt)
    const durationMs = endsAt.getTime() - startsAt.getTime()
    const durationMinutes = Math.max(Math.round(durationMs / 60000), 1)
    const customType = (editingBlock.metadata as Record<string, unknown>)?.customType as string | undefined
    return {
      type: customType || editingBlock.type,
      title: editingBlock.title,
      description: editingBlock.description || '',
      section: getTimeOfDay(startsAt),
      durationMinutes,
      locationText: editingBlock.locationText || '',
    }
  }, [editingBlock, drawerSection])

  // Group blocks by date, then by time-of-day within each date
  const grouped = useMemo(() => {
    if (!blocks || blocks.length === 0) return {}

    const byDate: Record<string, EventScheduleBlock[]> = {}
    for (const block of blocks) {
      const dateKey = format(parseISO(block.startsAt), 'yyyy-MM-dd')
      if (!byDate[dateKey]) byDate[dateKey] = []
      byDate[dateKey].push(block)
    }

    // Sort by sortOrder first, then by startsAt as fallback
    for (const dateKey of Object.keys(byDate)) {
      byDate[dateKey].sort((a, b) => {
        if (a.sortOrder !== undefined && b.sortOrder !== undefined && a.sortOrder !== b.sortOrder) {
          return a.sortOrder - b.sortOrder
        }
        return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
      })
    }

    return byDate
  }, [blocks])

  if (isLoading) return <ScheduleSkeleton />

  return (
    <div className="space-y-5">
      {/* View mode toggle + Day navigator */}
      <div className="flex items-center justify-between">
        {/* Order / Timeline pill toggle */}
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

        {/* Day navigator */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedDate((d) => subDays(d, 1))}
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="px-4 py-2 min-w-[200px] text-center">
            <h4 className="text-sm font-semibold text-slate-900">
              {format(selectedDate, 'EEEE, MMMM d')}
            </h4>
          </div>
          <button
            onClick={() => setSelectedDate((d) => addDays(d, 1))}
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Current day blocks or empty state */}
      {(() => {
        const dateKey = format(selectedDate, 'yyyy-MM-dd')
        const dayBlocks = grouped[dateKey] || []

        if (dayBlocks.length === 0) {
          return <ScheduleEmptyState onAdd={() => openAddDrawer()} />
        }

        // Group by time of day
        const byPeriod: Record<'morning' | 'afternoon' | 'evening', EventScheduleBlock[]> = {
          morning: [],
          afternoon: [],
          evening: [],
        }
        for (const block of dayBlocks) {
          const period = getTimeOfDay(parseISO(block.startsAt))
          byPeriod[period].push(block)
        }

        const activePeriods = (['morning', 'afternoon', 'evening'] as const).filter(
          (p) => byPeriod[p].length > 0
        )

        return (
          <div className="space-y-5">
            {activePeriods.map((period) => (
              <ScheduleSection
                key={period}
                period={period}
                blocks={byPeriod[period]}
                allTypes={allTypes}
                sectionStartTime={getSectionStartTime(period, dateKey, byPeriod[period])}
                onEditBlock={openEditDrawer}
                onDelete={handleDelete}
                onReorder={handleReorder}
                deletingId={deletingId}
              />
            ))}
          </div>
        )
      })()}

      {/* Add / Edit Block Drawer */}
      <AddBlockDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setEditingBlock(null)
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
