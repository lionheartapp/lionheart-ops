'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import DetailDrawer from '@/components/DetailDrawer'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import type { BlockTypeConfig } from '@/lib/types/event-project'
import {
  TYPE_COLORS,
  DURATION_PRESETS,
  formatDuration,
  formatPreset,
} from '@/lib/schedule-utils'
import { BlockFilesTab } from './BlockFilesTab'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DrawerFormData {
  type: string
  title: string
  description: string
  durationMinutes: number
  locationText: string
  servicePosition: 'pre' | 'during' | 'post'
}

export const defaultDrawerForm: DrawerFormData = {
  type: 'SESSION',
  title: '',
  description: '',
  durationMinutes: 30,
  locationText: '',
  servicePosition: 'during',
}

// ─── Props ───────────────────────────────────────────────────────────────────

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

// ─── Component ───────────────────────────────────────────────────────────────

export function AddBlockDrawer({
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
      color: colorConfig.bg,
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
          <Input
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="e.g. Morning Assembly, Lunch..."
            hasError={!!errors.title}
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
                  <Input
                    value={newTypeLabel}
                    onChange={(e) => setNewTypeLabel(e.target.value)}
                    placeholder="e.g. Workshop, Keynote, Panel"
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
            <div className="w-36">
              <Input
                size="sm"
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
              />
            </div>
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
          <Input
            value={form.locationText}
            onChange={(e) => update('locationText', e.target.value)}
            placeholder="e.g. Main Hall, Beach Pavilion"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Notes (optional)</label>
          <Textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={3}
            placeholder="Instructions, details, leaders..."
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
