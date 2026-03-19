'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, parseISO, differenceInMinutes } from 'date-fns'
import {
  CalendarDays,
  Plus,
  MapPin,
  User,
  Clock,
  ChevronDown,
  Loader2,
  GripVertical,
  List,
  Timer,
  Sunrise,
  Sunset,
  Sun,
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
type ApiBlockType = typeof VALID_API_TYPES[number]

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
  } catch { /* ignore */ }
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
  morning: { label: 'Morning', icon: Sunrise, accent: 'text-amber-600' },
  afternoon: { label: 'Afternoon', icon: Sun, accent: 'text-orange-500' },
  evening: { label: 'Evening', icon: Sunset, accent: 'text-indigo-500' },
}

const SECTIONS = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
] as const

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
  startTime: string
  endTime: string
  locationText: string
}

const defaultDrawerForm: DrawerFormData = {
  type: 'SESSION',
  title: '',
  description: '',
  section: 'morning',
  startTime: '09:00',
  endTime: '10:00',
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
  const sectionRef = useRef<HTMLDivElement>(null)

  // Reset form when drawer opens
  useEffect(() => {
    if (open) {
      setForm({ ...defaultDrawerForm, ...initialData })
      setErrors({})
      setShowCreateType(false)
      setNewTypeLabel('')
      setNewTypeColor(TYPE_COLORS[0].value)
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const newErrors: Partial<Record<keyof DrawerFormData, string>> = {}
    if (!form.title.trim()) newErrors.title = 'Title is required'
    if (!form.startTime) newErrors.startTime = 'Required'
    if (!form.endTime) newErrors.endTime = 'Required'
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

  // Split types into default and custom
  const defaultTypes = allTypes.filter((t) => !t.isCustom)
  const customTypes = allTypes.filter((t) => t.isCustom)

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-[420px] bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                {initialData?.title ? 'Edit Block' : 'Add Block'}
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="px-6 py-5 space-y-6">
                {/* Block title */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Block title</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => update('title', e.target.value)}
                    placeholder="e.g. Morning Worship, Lunch..."
                    autoFocus
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
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: t.hexColor }}
                              />
                              {t.label}
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}

                  {/* Divider */}
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
                            autoFocus
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
                                  newTypeColor === c.value
                                    ? 'ring-2 ring-offset-2 ring-slate-400 scale-110'
                                    : 'hover:scale-105'
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
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${sectionOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {sectionOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.15 }}
                          className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden"
                        >
                          {SECTIONS.map((s) => {
                            const cfg = TIME_OF_DAY_CONFIG[s.value]
                            const Icon = cfg.icon
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
                                <Icon className={`w-4 h-4 ${cfg.accent}`} />
                                {s.label}
                              </button>
                            )
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Duration</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <input
                        type="time"
                        value={form.startTime}
                        onChange={(e) => update('startTime', e.target.value)}
                        className={`w-full px-4 py-3 text-sm bg-white border rounded-xl focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all ${
                          errors.startTime ? 'border-red-300' : 'border-slate-200'
                        }`}
                      />
                    </div>
                    <div>
                      <input
                        type="time"
                        value={form.endTime}
                        onChange={(e) => update('endTime', e.target.value)}
                        className={`w-full px-4 py-3 text-sm bg-white border rounded-xl focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all ${
                          errors.endTime ? 'border-red-300' : 'border-slate-200'
                        }`}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-1.5 text-xs text-slate-400">
                    <span>Start</span>
                    <span className="mx-1">&rarr;</span>
                    <span>End</span>
                  </div>
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
              </div>

              {/* Drawer footer */}
              <div className="sticky bottom-0 px-6 py-4 border-t border-slate-200 bg-white flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitLabel}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Block Row ───────────────────────────────────────────────────────────────

interface BlockRowProps {
  block: EventScheduleBlock
  allTypes: BlockTypeConfig[]
  onEdit: (block: EventScheduleBlock) => void
  onDelete: (blockId: string) => Promise<void>
  isDeleting?: boolean
}

function BlockRow({ block, allTypes, onEdit, onDelete, isDeleting }: BlockRowProps) {
  const [isHovered, setIsHovered] = useState(false)

  // Check metadata for custom type
  const displayType = (block.metadata as Record<string, unknown>)?.customType as string | undefined
  const typeConfig = getBlockTypeConfig(displayType || block.type, allTypes)
  const startsAt = parseISO(block.startsAt)
  const endsAt = parseISO(block.endsAt)
  const duration = differenceInMinutes(endsAt, startsAt)
  const timeRange = `${format(startsAt, 'h:mm a')} – ${format(endsAt, 'h:mm a')}`

  return (
    <motion.div
      variants={listItem}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative flex items-center gap-3 px-3 py-3 bg-white border border-slate-200/80 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all cursor-default"
    >
      {/* Drag handle */}
      <div className="flex-shrink-0 opacity-0 group-hover:opacity-40 transition-opacity cursor-grab active:cursor-grabbing">
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
          <span className="text-xs font-medium text-slate-500">{formatDuration(duration)}</span>
        </div>

        {/* Time range */}
        <div className="flex-shrink-0 flex items-center gap-1.5 text-xs text-slate-500 min-w-[140px] justify-end">
          <Clock className="w-3 h-3 text-slate-400" />
          {timeRange}
        </div>
      </div>

      {/* Hover actions — Edit / Delete buttons */}
      <div
        className={`flex items-center gap-2 transition-opacity ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}
      >
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
          {isDeleting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Delete'
          )}
        </button>
      </div>
    </motion.div>
  )
}

// ─── Section Component ───────────────────────────────────────────────────────

interface ScheduleSectionProps {
  period: 'morning' | 'afternoon' | 'evening'
  blocks: EventScheduleBlock[]
  allTypes: BlockTypeConfig[]
  viewMode: 'order' | 'timeline'
  onViewModeChange: (mode: 'order' | 'timeline') => void
  onAddBlock: () => void
  onEditBlock: (block: EventScheduleBlock) => void
  onDelete: (blockId: string) => Promise<void>
  deletingId: string | null
}

function ScheduleSection({
  period,
  blocks,
  allTypes,
  viewMode,
  onViewModeChange,
  onAddBlock,
  onEditBlock,
  onDelete,
  deletingId,
}: ScheduleSectionProps) {
  const config = TIME_OF_DAY_CONFIG[period]
  const Icon = config.icon
  const totalMins = blocks.reduce((sum, b) => {
    return sum + differenceInMinutes(parseISO(b.endsAt), parseISO(b.startsAt))
  }, 0)

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
        </div>
        <div className="flex items-center gap-1.5">
          {/* View mode toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => onViewModeChange('order')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'order'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <List className="w-3 h-3" />
              Order
            </button>
            <button
              onClick={() => onViewModeChange('timeline')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'timeline'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Timer className="w-3 h-3" />
              Timeline
            </button>
          </div>

          {/* Add block to section */}
          <button
            onClick={onAddBlock}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            Add Block
          </button>
        </div>
      </div>

      {/* Block list */}
      <motion.div
        variants={staggerContainer(0.03)}
        initial="hidden"
        animate="visible"
        className="space-y-1.5"
      >
        {blocks.map((block) => (
          <BlockRow
            key={block.id}
            block={block}
            allTypes={allTypes}
            onEdit={onEditBlock}
            onDelete={onDelete}
            isDeleting={deletingId === block.id}
          />
        ))}
      </motion.div>
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
  const { toast } = useToast()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingBlock, setEditingBlock] = useState<EventScheduleBlock | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'order' | 'timeline'>('order')
  const [customTypes, setCustomTypes] = useState<BlockTypeConfig[]>(() => loadCustomTypes(eventProjectId))

  const allTypes = useMemo(() => getAllBlockTypes(eventProjectId, customTypes), [eventProjectId, customTypes])

  function handleAddCustomType(type: BlockTypeConfig) {
    const updated = [...customTypes, type]
    setCustomTypes(updated)
    saveCustomTypes(eventProjectId, updated)
  }

  /** Convert section + times into a proper Date for the API */
  function buildDateTime(section: 'morning' | 'afternoon' | 'evening', time: string, dateStr: string): Date {
    return new Date(`${dateStr}T${time}:00`)
  }

  /** Pick a reasonable date string. Use defaultDate or today. */
  function getDateForSection(section: 'morning' | 'afternoon' | 'evening'): string {
    return defaultDate || format(new Date(), 'yyyy-MM-dd')
  }

  async function handleCreate(data: DrawerFormData) {
    const dateStr = getDateForSection(data.section)
    const startsAt = buildDateTime(data.section, data.startTime, dateStr)
    const endsAt = buildDateTime(data.section, data.endTime, dateStr)

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
    const startsAtOld = parseISO(editingBlock.startsAt)
    const dateStr = format(startsAtOld, 'yyyy-MM-dd')
    const startsAt = buildDateTime(data.section, data.startTime, dateStr)
    const endsAt = buildDateTime(data.section, data.endTime, dateStr)

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

  function openAddDrawer(section?: 'morning' | 'afternoon' | 'evening') {
    setEditingBlock(null)
    setDrawerOpen(true)
  }

  function openEditDrawer(block: EventScheduleBlock) {
    setEditingBlock(block)
    setDrawerOpen(true)
  }

  // Build initial form data for editing
  const editInitial = useMemo<Partial<DrawerFormData> | undefined>(() => {
    if (!editingBlock) return undefined
    const startsAt = parseISO(editingBlock.startsAt)
    const endsAt = parseISO(editingBlock.endsAt)
    const customType = (editingBlock.metadata as Record<string, unknown>)?.customType as string | undefined
    return {
      type: customType || editingBlock.type,
      title: editingBlock.title,
      description: editingBlock.description || '',
      section: getTimeOfDay(startsAt),
      startTime: format(startsAt, 'HH:mm'),
      endTime: format(endsAt, 'HH:mm'),
      locationText: editingBlock.locationText || '',
    }
  }, [editingBlock])

  // Group blocks by date, then by time-of-day within each date
  const grouped = useMemo(() => {
    if (!blocks || blocks.length === 0) return {}

    const byDate: Record<string, EventScheduleBlock[]> = {}
    for (const block of blocks) {
      const dateKey = format(parseISO(block.startsAt), 'yyyy-MM-dd')
      if (!byDate[dateKey]) byDate[dateKey] = []
      byDate[dateKey].push(block)
    }

    for (const dateKey of Object.keys(byDate)) {
      byDate[dateKey].sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
      )
    }

    return byDate
  }, [blocks])

  const sortedDates = Object.keys(grouped).sort()

  if (isLoading) return <ScheduleSkeleton />

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Schedule</h3>
          {blocks && blocks.length > 0 && (
            <p className="text-xs text-slate-500 mt-0.5">
              {blocks.length} block{blocks.length !== 1 ? 's' : ''} across{' '}
              {sortedDates.length} day{sortedDates.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <button
          onClick={() => openAddDrawer()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Block
        </button>
      </div>

      {/* Block list or empty state */}
      {!blocks || blocks.length === 0 ? (
        <ScheduleEmptyState onAdd={() => openAddDrawer()} />
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateKey) => {
            const dayBlocks = grouped[dateKey]
            const dayDate = new Date(dateKey + 'T00:00:00')

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
              <div key={dateKey}>
                {/* Day header */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 border border-slate-200">
                    <span className="text-sm font-bold text-slate-700">{format(dayDate, 'd')}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">{format(dayDate, 'EEEE')}</h4>
                    <p className="text-xs text-slate-400">{format(dayDate, 'MMMM d, yyyy')}</p>
                  </div>
                  <div className="flex-1 h-px bg-slate-200 ml-3" />
                </div>

                {/* Periods */}
                <div className="space-y-5 ml-2">
                  {activePeriods.map((period) => (
                    <ScheduleSection
                      key={period}
                      period={period}
                      blocks={byPeriod[period]}
                      allTypes={allTypes}
                      viewMode={viewMode}
                      onViewModeChange={setViewMode}
                      onAddBlock={() => openAddDrawer(period)}
                      onEditBlock={openEditDrawer}
                      onDelete={handleDelete}
                      deletingId={deletingId}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

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
