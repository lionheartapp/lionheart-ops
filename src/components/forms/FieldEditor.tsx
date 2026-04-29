'use client'

import { useState, useRef, useEffect } from 'react'
import { X, ChevronDown, Plus, AlertTriangle, Eye, EyeOff, GripVertical } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { FormFieldData } from './FormFieldRenderer'
import {
  FIELD_TYPE_META,
  getFieldTypeMeta,
  slugifyFieldKey,
  type FormFieldType,
} from '@/lib/forms/schemas'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FieldEditorProps {
  field: FormFieldData
  allFields: FormFieldData[]
  onChange: (next: FormFieldData) => void
  onRemove: () => void
  dragListeners?: Record<string, unknown>
  dragAttributes?: Record<string, unknown>
  conditionCandidates?: Array<{
    key: string
    label: string
    options?: string[]
  }>
  /** Start expanded (e.g., when just added) */
  defaultExpanded?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getIcon(iconName: string, className = 'w-4 h-4') {
  const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[iconName]
  return Icon ? <Icon className={className} /> : null
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FieldEditor({
  field,
  allFields,
  onChange,
  onRemove,
  dragListeners,
  dragAttributes,
  conditionCandidates,
  defaultExpanded = false,
}: FieldEditorProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const labelRef = useRef<HTMLInputElement>(null)
  const isCheckbox = field.type === 'CHECKBOX'
  const isPickable = field.type === 'DROPDOWN' || field.type === 'MULTI_SELECT'
  const meta = getFieldTypeMeta(field.type)

  // Auto-focus label when expanded
  useEffect(() => {
    if (expanded && defaultExpanded && labelRef.current) {
      labelRef.current.focus()
    }
  }, [expanded, defaultExpanded])

  const candidates = conditionCandidates ?? [
    ...allFields
      .filter(
        (f) =>
          f.key !== field.key &&
          (f.type === 'DROPDOWN' || f.type === 'MULTI_SELECT')
      )
      .map((f) => ({ key: f.key, label: f.label, options: f.options })),
  ]

  const condSourceField = candidates.find((c) => c.key === field.condFieldKey)
  const hasConditional = !!field.condFieldKey && field.condFieldKey.length > 0

  function update(patch: Partial<FormFieldData>) {
    onChange({ ...field, ...patch })
  }

  return (
    <div className={`rounded-xl border transition-colors duration-200 ${
      expanded ? 'border-slate-300 bg-white shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
    }`}>
      {/* ── Collapsed header ── */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        {/* Drag handle */}
        <button
          type="button"
          className="p-0.5 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none"
          {...(dragListeners || {})}
          {...(dragAttributes || {})}
          tabIndex={-1}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>

        {/* Field type icon */}
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
          expanded ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
        } transition-colors`}>
          {getIcon(meta.icon, 'w-3.5 h-3.5')}
        </div>

        {/* Label + type */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex-1 text-left cursor-pointer min-w-0"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-slate-900 truncate">
              {field.label || <span className="text-slate-400 italic">Untitled question</span>}
            </span>
            {field.required && <span className="text-red-500 text-sm">*</span>}
          </div>
          <span className="text-[11px] text-slate-400">{meta.label}</span>
        </button>

        {/* Status badges */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {isCheckbox && field.autoEscalate && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-md">
              <AlertTriangle className="w-2.5 h-2.5" />
              Auto-escalate
            </span>
          )}
          {hasConditional ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-md">
              <EyeOff className="w-2.5 h-2.5" />
              Conditional
            </span>
          ) : (
            <span className="text-[10px] text-slate-300 flex items-center gap-1">
              <Eye className="w-2.5 h-2.5" /> Always shown
            </span>
          )}
        </div>

        {/* Remove */}
        <button
          type="button"
          onClick={onRemove}
          className="p-1 text-slate-300 hover:text-red-500 cursor-pointer transition-colors rounded-md hover:bg-red-50"
          aria-label="Remove field"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Expanded editor ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-100 px-4 py-4 space-y-4">
              {/* Question label — large, prominent */}
              <div>
                <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Question</label>
                <input
                  ref={labelRef}
                  style={{ borderRadius: 0 }}
                  className="mt-1 w-full text-base font-medium text-slate-900 bg-transparent border-0 border-b border-slate-200 focus:border-slate-900 outline-none pb-1 transition-colors"
                  value={field.label}
                  placeholder="What do you want to ask?"
                  onChange={(e) =>
                    update({
                      label: e.target.value,
                      key: slugifyFieldKey(e.target.value) || field.key,
                    })
                  }
                />
              </div>

              {/* Help text */}
              <div>
                <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Help text</label>
                <input
                  style={{ borderRadius: 0 }}
                  className="mt-1 w-full text-sm text-slate-600 bg-transparent border-0 border-b border-slate-100 focus:border-slate-400 outline-none pb-1 transition-colors"
                  value={field.helpText || ''}
                  placeholder="Optional description for the submitter..."
                  onChange={(e) => update({ helpText: e.target.value || null })}
                />
              </div>

              {/* Type selector — pill buttons */}
              <div>
                <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Field type</label>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {FIELD_TYPE_META.map((t) => (
                    <button
                      key={t.type}
                      type="button"
                      onClick={() => update({ type: t.type as FormFieldType })}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                        field.type === t.type
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {getIcon(t.icon, 'w-3 h-3')}
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Placeholder (text-like fields) */}
              {['TEXT', 'TEXTAREA', 'NUMBER', 'EMAIL', 'PHONE', 'DROPDOWN'].includes(field.type) && (
                <div>
                  <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Placeholder</label>
                  <input
                    className="mt-1 w-full text-sm text-slate-600 bg-slate-50 rounded-lg border border-slate-200 px-3 py-1.5 focus:border-slate-400 outline-none transition-colors"
                    value={field.placeholder || ''}
                    placeholder="e.g. Enter the affected area..."
                    onChange={(e) => update({ placeholder: e.target.value || null })}
                  />
                </div>
              )}

              {/* Options — chip-style for dropdown/multiselect */}
              {isPickable && (
                <div>
                  <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Options</label>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(field.options || []).map((opt, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-sm text-slate-700"
                      >
                        {opt}
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...(field.options || [])]
                            next.splice(i, 1)
                            update({ options: next })
                          }}
                          className="text-slate-400 hover:text-red-500 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const val = prompt('Add an option:')
                        if (val?.trim()) {
                          update({ options: [...(field.options || []), val.trim()] })
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-slate-300 text-sm text-slate-500 hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Add option
                    </button>
                  </div>
                </div>
              )}

              {/* Toggles row */}
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <div
                    role="switch"
                    aria-checked={!!field.required}
                    onClick={() => update({ required: !field.required })}
                    className={`relative w-8 h-[18px] rounded-full transition-colors cursor-pointer ${
                      field.required ? 'bg-slate-900' : 'bg-slate-200'
                    }`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${
                      field.required ? 'translate-x-3.5' : ''
                    }`} />
                  </div>
                  <span className="text-sm text-slate-700">Required</span>
                </label>

                {isCheckbox && (
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <div
                      role="switch"
                      aria-checked={!!field.autoEscalate}
                      onClick={() => update({ autoEscalate: !field.autoEscalate })}
                      className={`relative w-8 h-[18px] rounded-full transition-colors cursor-pointer ${
                        field.autoEscalate ? 'bg-orange-500' : 'bg-slate-200'
                      }`}
                    >
                      <div className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${
                        field.autoEscalate ? 'translate-x-3.5' : ''
                      }`} />
                    </div>
                    <span className="text-sm text-slate-700">Auto-escalate to Urgent</span>
                  </label>
                )}
              </div>

              {/* Conditional logic — readable sentence */}
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                    Visibility
                  </span>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <div
                      role="switch"
                      aria-checked={hasConditional}
                      onClick={() =>
                        update(
                          hasConditional
                            ? { condFieldKey: null, condEquals: null }
                            : { condFieldKey: candidates[0]?.key || '', condEquals: '' }
                        )
                      }
                      className={`relative w-8 h-[18px] rounded-full transition-colors cursor-pointer ${
                        hasConditional ? 'bg-purple-500' : 'bg-slate-200'
                      }`}
                    >
                      <div className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${
                        hasConditional ? 'translate-x-3.5' : ''
                      }`} />
                    </div>
                    <span className="text-xs text-slate-600">
                      {hasConditional ? 'Conditional' : 'Always shown'}
                    </span>
                  </label>
                </div>

                {hasConditional && candidates.length > 0 && (
                  <div className="mt-2.5 flex items-center gap-2 flex-wrap text-sm">
                    <span className="text-purple-600 font-medium">Show when</span>
                    <select
                      value={field.condFieldKey || ''}
                      onChange={(e) => update({ condFieldKey: e.target.value, condEquals: '' })}
                      className="rounded-lg border border-purple-200 bg-white px-2 py-1 text-sm cursor-pointer focus:border-purple-400 outline-none"
                    >
                      {candidates.map((c) => (
                        <option key={c.key} value={c.key}>{c.label}</option>
                      ))}
                    </select>
                    <span className="text-purple-600 font-medium">is</span>
                    {condSourceField?.options ? (
                      <select
                        value={field.condEquals || ''}
                        onChange={(e) => update({ condEquals: e.target.value })}
                        className="rounded-lg border border-purple-200 bg-white px-2 py-1 text-sm cursor-pointer focus:border-purple-400 outline-none"
                      >
                        <option value="">Select...</option>
                        {condSourceField.options.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={field.condEquals || ''}
                        onChange={(e) => update({ condEquals: e.target.value })}
                        placeholder="value..."
                        className="rounded-lg border border-purple-200 bg-white px-2 py-1 text-sm focus:border-purple-400 outline-none w-32"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
