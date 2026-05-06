'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Layers, Monitor, Wrench, Plus, X, Pencil, Check } from 'lucide-react'
import { listItem } from '@/lib/animations'
import type { EventProject } from '@/lib/hooks/useEventProject'
import { useUpdateEventProject } from '@/lib/hooks/useEventProject'
import { useToast } from '@/components/Toast'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * The stored shape for a resource requirement.
 *
 * Backwards-compatible: legacy data is plain `string`, new data is an object.
 * Reads accept either shape; writes always use the object form.
 */
export interface ResourceItem {
  name: string
  qty?: number
  note?: string
}

type StoredResource = string | ResourceItem

interface CategoryConfig {
  key: 'avNeeds' | 'facilityNeeds'
  label: string
  Icon: typeof Monitor
  suggestions: readonly string[]
}

const AV_SUGGESTIONS = [
  'Projector', 'Microphone', 'Sound System', 'Laptop', 'Screen',
  'Video Camera', 'Live Stream', 'Stage Lighting', 'Whiteboard', 'Display TV',
] as const

const FACILITY_SUGGESTIONS = [
  'Tables', 'Chairs', 'Stage Setup', 'Parking Cones', 'Trash Bins',
  'Extension Cords', 'Signage', 'Tent/Canopy', 'Podium', 'Cleaning Crew',
] as const

const AV_CATEGORY: CategoryConfig = {
  key: 'avNeeds',
  label: 'A/V Production',
  Icon: Monitor,
  suggestions: AV_SUGGESTIONS,
}

const FACILITIES_CATEGORY: CategoryConfig = {
  key: 'facilityNeeds',
  label: 'Facilities',
  Icon: Wrench,
  suggestions: FACILITY_SUGGESTIONS,
}

// ─── Read normalization ─────────────────────────────────────────────────────

function normalizeItem(raw: StoredResource): ResourceItem {
  if (typeof raw === 'string') return { name: raw }
  return {
    name: raw.name ?? '',
    qty: typeof raw.qty === 'number' && raw.qty > 1 ? raw.qty : undefined,
    note: typeof raw.note === 'string' && raw.note.trim().length > 0 ? raw.note : undefined,
  }
}

function readItems(meta: Record<string, unknown>, key: string): ResourceItem[] {
  const raw = meta[key]
  if (!Array.isArray(raw)) return []
  return raw
    .filter((entry): entry is StoredResource => typeof entry === 'string' || typeof entry === 'object')
    .map(normalizeItem)
    .filter((item) => item.name.trim().length > 0)
}

// ─── Add control ────────────────────────────────────────────────────────────

interface AddItemControlProps {
  existingNames: string[]
  suggestions: readonly string[]
  onAdd: (name: string) => void
}

function AddItemControl({ existingNames, suggestions, onAdd }: AddItemControlProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  function commit(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return
    if (existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
      setQuery('')
      return
    }
    onAdd(trimmed)
    setQuery('')
    setIsOpen(false)
  }

  function open() {
    setIsOpen(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const filtered = suggestions.filter(
    (s) => !existingNames.some((n) => n.toLowerCase() === s.toLowerCase())
      && s.toLowerCase().includes(query.toLowerCase()),
  )

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={open}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-dashed border-slate-300 hover:border-slate-400 transition-colors cursor-pointer"
      >
        <Plus className="w-3 h-3" />
        Add item
      </button>
    )
  }

  return (
    <div ref={containerRef} className="relative min-w-[160px]">
      <Input
        ref={inputRef}
        size="sm"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(query) }
          if (e.key === 'Escape') { setIsOpen(false); setQuery('') }
        }}
        placeholder="Type or pick…"
      />
      <AnimatePresence>
        {(filtered.length > 0 || query.trim()) && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-20 top-full mt-1 left-0 w-56 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"
          >
            <div className="max-h-48 overflow-y-auto py-1">
              {filtered.map((s) => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(s)}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  {s}
                </button>
              ))}
              {query.trim() && !filtered.some((s) => s.toLowerCase() === query.trim().toLowerCase()) && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(query)}
                  className="w-full text-left px-3 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer flex items-center gap-1.5 border-t border-slate-100"
                >
                  <Plus className="w-3 h-3" />
                  Create &ldquo;{query.trim()}&rdquo;
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Item row ───────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: ResourceItem
  onUpdate: (next: ResourceItem) => void
  onRemove: () => void
}

function ItemRow({ item, onUpdate, onRemove }: ItemRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draftQty, setDraftQty] = useState(item.qty ?? 1)
  const [draftNote, setDraftNote] = useState(item.note ?? '')

  function startEdit() {
    setDraftQty(item.qty ?? 1)
    setDraftNote(item.note ?? '')
    setIsEditing(true)
  }

  function save() {
    onUpdate({
      name: item.name,
      qty: draftQty > 1 ? draftQty : undefined,
      note: draftNote.trim().length > 0 ? draftNote.trim() : undefined,
    })
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div className="bg-white px-3 py-2.5 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-900 flex-1 min-w-0 truncate">{item.name}</span>
          <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
            Qty
            <div className="w-14">
              <Input
                size="sm"
                type="number"
                min={1}
                value={draftQty}
                onChange={(e) => setDraftQty(Math.max(1, Number(e.target.value) || 1))}
                className="text-center"
              />
            </div>
          </label>
          <button
            type="button"
            onClick={save}
            className="p-1 rounded text-green-600 hover:bg-green-50 cursor-pointer"
            title="Save"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
            title="Cancel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <Textarea
          value={draftNote}
          onChange={(e) => setDraftNote(e.target.value)}
          placeholder="Add details — quantity, location, special requirements…"
          rows={2}
        />
      </div>
    )
  }

  return (
    <div className="group/item bg-white px-3 py-2.5 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-900">{item.name}</span>
          {item.qty && item.qty > 1 && (
            <span className="text-[11px] text-slate-500 px-1.5 py-0.5 bg-slate-100 rounded-full">
              ×{item.qty}
            </span>
          )}
          {!item.note && (
            <button
              type="button"
              onClick={startEdit}
              className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors cursor-pointer opacity-0 group-hover/item:opacity-100"
            >
              + note
            </button>
          )}
        </div>
        {item.note && (
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.note}</p>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={startEdit}
          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          title="Edit"
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
          title="Remove"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Category block ─────────────────────────────────────────────────────────

interface CategoryBlockProps {
  config: CategoryConfig
  items: ResourceItem[]
  onChange: (next: ResourceItem[]) => void
}

function CategoryBlock({ config, items, onChange }: CategoryBlockProps) {
  const Icon = config.Icon

  function addItem(name: string) {
    onChange([...items, { name }])
  }

  function updateItem(index: number, next: ResourceItem) {
    onChange(items.map((item, i) => (i === index ? next : item)))
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-xs font-medium text-slate-700">{config.label}</span>
        {items.length > 0 && (
          <span className="text-[11px] text-slate-400">· {items.length}</span>
        )}
      </div>

      {items.length > 0 ? (
        <div className="rounded-lg border border-slate-200 overflow-hidden divide-y divide-slate-100 mb-2">
          {items.map((item, i) => (
            <ItemRow
              key={`${item.name}-${i}`}
              item={item}
              onUpdate={(next) => updateItem(i, next)}
              onRemove={() => removeItem(i)}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic mb-2">No items yet.</p>
      )}

      <AddItemControl
        existingNames={items.map((i) => i.name)}
        suggestions={config.suggestions}
        onAdd={addItem}
      />
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ResourceRequirementsSection({ project }: { project: EventProject }) {
  const meta = (project.metadata ?? {}) as Record<string, unknown>
  const updateProject = useUpdateEventProject(project.id)
  const { toast } = useToast()

  const avItems = readItems(meta, 'avNeeds')
  const facilityItems = readItems(meta, 'facilityNeeds')
  const hasAV = project.requiresAV
  const hasFacilities = project.requiresFacilities

  if (!hasAV && !hasFacilities) return null

  const totalItems = avItems.length + facilityItems.length
  const activeCategories = (hasAV ? 1 : 0) + (hasFacilities ? 1 : 0)

  async function saveCategory(key: 'avNeeds' | 'facilityNeeds', items: ResourceItem[]) {
    try {
      await updateProject.mutateAsync({ metadata: { ...meta, [key]: items } })
    } catch {
      toast('Failed to update', 'error')
    }
  }

  return (
    <motion.div variants={listItem} className="ui-glass p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-400" />
          Resource Requirements
        </h3>
        {totalItems > 0 && (
          <span className="text-xs text-slate-500">
            {totalItems} {totalItems === 1 ? 'item' : 'items'} across {activeCategories}{' '}
            {activeCategories === 1 ? 'team' : 'teams'}
          </span>
        )}
      </div>

      <div className="space-y-5">
        {hasAV && (
          <CategoryBlock
            config={AV_CATEGORY}
            items={avItems}
            onChange={(next) => saveCategory('avNeeds', next)}
          />
        )}
        {hasFacilities && (
          <CategoryBlock
            config={FACILITIES_CATEGORY}
            items={facilityItems}
            onChange={(next) => saveCategory('facilityNeeds', next)}
          />
        )}
      </div>
    </motion.div>
  )
}
