'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import DragHandle from './DragHandle'
import type { FormFieldData } from './FormFieldRenderer'
import {
  FIELD_TYPE_META,
  FORM_FIELD_TYPES,
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
  /** Fields that can be targets for conditional logic (standard + other dropdown fields) */
  conditionCandidates?: Array<{
    key: string
    label: string
    options?: string[]
  }>
}

// ─── Shared input class ───────────────────────────────────────────────────────

const inputClass =
  'w-full rounded-xl border border-[rgba(17,15,10,0.1)] bg-white px-2.5 py-1.5 text-sm text-[#1a1915] focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/20 focus:outline-none transition-colors duration-200'

// ─── Component ────────────────────────────────────────────────────────────────

export default function FieldEditor({
  field,
  allFields,
  onChange,
  onRemove,
  dragListeners,
  dragAttributes,
  conditionCandidates,
}: FieldEditorProps) {
  const [expanded, setExpanded] = useState(false)
  const isCheckbox = field.type === 'CHECKBOX'
  const isPickable = field.type === 'DROPDOWN' || field.type === 'MULTI_SELECT'
  const meta = getFieldTypeMeta(field.type)

  // Build condition candidates from standard + other dropdown fields if not provided
  const candidates = conditionCandidates ?? [
    ...allFields
      .filter(
        (f) =>
          f.key !== field.key &&
          (f.type === 'DROPDOWN' || f.type === 'MULTI_SELECT')
      )
      .map((f) => ({ key: f.key, label: f.label, options: f.options })),
  ]

  const condSourceField = candidates.find(
    (c) => c.key === field.condFieldKey
  )
  const hasConditional = !!field.condFieldKey && field.condFieldKey.length > 0

  function update(patch: Partial<FormFieldData>) {
    onChange({ ...field, ...patch })
  }

  return (
    <div className="ui-glass-hover rounded-2xl overflow-hidden">
      {/* Collapsed header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <DragHandle listeners={dragListeners} attributes={dragAttributes} />

        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex-1 text-left cursor-pointer min-w-0"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-[#1a1915] truncate">
              {field.label || (
                <em className="text-[#a8a49d]">Untitled field</em>
              )}
            </span>
            {field.required && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-red-600 bg-red-50 px-1.5 py-0.5 rounded-md">
                Required
              </span>
            )}
            {hasConditional && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-md">
                Conditional
              </span>
            )}
            {isCheckbox && field.autoEscalate && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded-md">
                Auto-escalate
              </span>
            )}
          </div>
          <div className="text-xs text-[#a8a49d] mt-0.5">
            {meta.label} · key:{' '}
            <code className="text-[#6a6864]">{field.key}</code>
          </div>
        </button>

        <button
          type="button"
          onClick={onRemove}
          className="text-[#a8a49d] hover:text-red-600 cursor-pointer transition-colors duration-200 p-1 rounded-lg hover:bg-red-50"
          aria-label="Remove field"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Expanded editor */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-[rgba(17,15,10,0.05)] bg-[#fafaf9] px-4 py-4 space-y-3">
              {/* Label + Type row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#6a6864]">
                    Label
                  </label>
                  <input
                    className={`mt-1 ${inputClass}`}
                    value={field.label}
                    onChange={(e) =>
                      update({
                        label: e.target.value,
                        key:
                          slugifyFieldKey(e.target.value) || field.key,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#6a6864]">
                    Type
                  </label>
                  <select
                    className={`mt-1 ${inputClass} cursor-pointer`}
                    value={field.type}
                    onChange={(e) =>
                      update({ type: e.target.value as FormFieldType })
                    }
                  >
                    {FIELD_TYPE_META.map((t) => (
                      <option key={t.type} value={t.type}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Placeholder (for text-like fields) */}
              {['TEXT', 'TEXTAREA', 'NUMBER', 'EMAIL', 'PHONE', 'DROPDOWN'].includes(
                field.type
              ) && (
                <div>
                  <label className="text-xs font-medium text-[#6a6864]">
                    Placeholder
                  </label>
                  <input
                    className={`mt-1 ${inputClass}`}
                    value={field.placeholder || ''}
                    onChange={(e) =>
                      update({ placeholder: e.target.value || null })
                    }
                  />
                </div>
              )}

              {/* Help text */}
              <div>
                <label className="text-xs font-medium text-[#6a6864]">
                  Help text
                </label>
                <input
                  className={`mt-1 ${inputClass}`}
                  value={field.helpText || ''}
                  onChange={(e) =>
                    update({ helpText: e.target.value || null })
                  }
                />
              </div>

              {/* Options (for dropdown/multiselect) */}
              {isPickable && (
                <div>
                  <label className="text-xs font-medium text-[#6a6864]">
                    Options (one per line)
                  </label>
                  <textarea
                    rows={4}
                    className={`mt-1 ${inputClass} font-mono`}
                    value={(field.options || []).join('\n')}
                    onChange={(e) =>
                      update({
                        options: e.target.value
                          .split('\n')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </div>
              )}

              {/* Required + Auto-escalate toggles */}
              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-[rgba(17,15,10,0.15)] text-blue-500 cursor-pointer"
                    checked={!!field.required}
                    onChange={(e) =>
                      update({ required: e.target.checked })
                    }
                  />
                  <span className="text-sm text-[#1a1915]">Required</span>
                </label>
                {isCheckbox && (
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-[rgba(17,15,10,0.15)] text-orange-500 cursor-pointer"
                      checked={!!field.autoEscalate}
                      onChange={(e) =>
                        update({ autoEscalate: e.target.checked })
                      }
                    />
                    <span className="text-sm text-[#1a1915]">
                      Auto-escalate to Urgent when checked
                    </span>
                  </label>
                )}
              </div>

              {/* Conditional logic */}
              <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-purple-700">
                    Conditional Logic
                  </span>
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-purple-800">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 cursor-pointer"
                      checked={hasConditional}
                      onChange={(e) =>
                        update(
                          e.target.checked
                            ? {
                                condFieldKey:
                                  candidates[0]?.key || '',
                                condEquals: '',
                              }
                            : {
                                condFieldKey: null,
                                condEquals: null,
                              }
                        )
                      }
                    />
                    Enable
                  </label>
                </div>
                {hasConditional && (
                  <div className="mt-2 grid grid-cols-3 gap-2 items-center">
                    <select
                      className="rounded-xl border border-purple-200 bg-white px-2 py-1.5 text-sm cursor-pointer"
                      value={field.condFieldKey || ''}
                      onChange={(e) =>
                        update({
                          condFieldKey: e.target.value,
                          condEquals: '',
                        })
                      }
                    >
                      {candidates.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <span className="text-center text-sm text-purple-700">
                      equals
                    </span>
                    {condSourceField?.options ? (
                      <select
                        className="rounded-xl border border-purple-200 bg-white px-2 py-1.5 text-sm cursor-pointer"
                        value={field.condEquals || ''}
                        onChange={(e) =>
                          update({ condEquals: e.target.value })
                        }
                      >
                        <option value="">Select\u2026</option>
                        {condSourceField.options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="rounded-xl border border-purple-200 bg-white px-2 py-1.5 text-sm"
                        value={field.condEquals || ''}
                        onChange={(e) =>
                          update({ condEquals: e.target.value })
                        }
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
