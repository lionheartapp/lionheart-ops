'use client'

import { useState } from 'react'
import { Trash2, ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import type { FormField } from '@/lib/hooks/useRegistrationForm'

// ─── Input type options ────────────────────────────────────────────────────────

const INPUT_TYPES: Array<{ value: FormField['inputType']; label: string }> = [
  { value: 'TEXT', label: 'Text' },
  { value: 'DROPDOWN', label: 'Dropdown' },
  { value: 'CHECKBOX', label: 'Checkbox' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'DATE', label: 'Date' },
  { value: 'FILE', label: 'File Upload' },
]

// ─── Props ─────────────────────────────────────────────────────────────────────

interface FormFieldEditorProps {
  field: FormField
  onChange: (field: FormField) => void
  onRemove: () => void
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function FormFieldEditor({ field, onChange, onRemove }: FormFieldEditorProps) {
  const [showHelpText, setShowHelpText] = useState(!!field.helpText)
  const [showPlaceholder, setShowPlaceholder] = useState(!!field.placeholder)

  const supportsPlaceholder = field.inputType === 'TEXT' || field.inputType === 'NUMBER'
  const supportsOptions = field.inputType === 'DROPDOWN' || field.inputType === 'CHECKBOX'

  function update(patch: Partial<FormField>) {
    onChange({ ...field, ...patch })
  }

  function handleOptionChange(index: number, optPatch: { label?: string; value?: string }) {
    const options = (field.options ?? []).map((opt, i) =>
      i === index ? { ...opt, ...optPatch } : opt
    )
    update({ options })
  }

  function addOption() {
    const options = [...(field.options ?? []), { label: '', value: '' }]
    update({ options })
  }

  function removeOption(index: number) {
    const options = (field.options ?? []).filter((_, i) => i !== index)
    update({ options })
  }

  return (
    <div className="ui-glass p-4 rounded-xl space-y-3 border border-slate-200/60">
      {/* Row 1: Input type + label + required toggle + remove */}
      <div className="flex items-start gap-3">
        {/* Input type selector */}
        <div className="w-36 flex-shrink-0">
          <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
          <select
            value={field.inputType}
            onChange={(e) => update({ inputType: e.target.value as FormField['inputType'] })}
            className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
          >
            {INPUT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Label */}
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-500 mb-1">Label *</label>
          <input
            type="text"
            value={field.label}
            onChange={(e) => update({ label: e.target.value })}
            placeholder="Field label"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {/* Required toggle */}
        <div className="flex-shrink-0 pt-5">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <button
              type="button"
              role="switch"
              aria-checked={field.required}
              onClick={() => update({ required: !field.required })}
              className={`relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 ${
                field.required ? 'bg-indigo-600' : 'bg-slate-200'
              } cursor-pointer`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
                  field.required ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
            <span className="text-xs text-slate-600">Required</span>
          </label>
        </div>

        {/* Remove button */}
        <button
          type="button"
          onClick={onRemove}
          className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors duration-200 cursor-pointer mt-4"
          aria-label="Remove field"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Optional: help text */}
      <div>
        <button
          type="button"
          onClick={() => setShowHelpText(!showHelpText)}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors duration-200 cursor-pointer"
        >
          {showHelpText ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          Help text (optional)
        </button>
        {showHelpText && (
          <input
            type="text"
            value={field.helpText ?? ''}
            onChange={(e) => update({ helpText: e.target.value || null })}
            placeholder="Displayed below the field as guidance"
            className="mt-1.5 w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        )}
      </div>

      {/* Optional: placeholder */}
      {supportsPlaceholder && (
        <div>
          <button
            type="button"
            onClick={() => setShowPlaceholder(!showPlaceholder)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors duration-200 cursor-pointer"
          >
            {showPlaceholder ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Placeholder text (optional)
          </button>
          {showPlaceholder && (
            <input
              type="text"
              value={field.placeholder ?? ''}
              onChange={(e) => update({ placeholder: e.target.value || null })}
              placeholder="Grayed-out hint inside the field"
              className="mt-1.5 w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          )}
        </div>
      )}

      {/* Options editor for dropdown/checkbox */}
      {supportsOptions && (
        <div className="space-y-2">
          <span className="text-xs font-medium text-slate-600">Options</span>
          {(field.options ?? []).map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={opt.label}
                onChange={(e) => handleOptionChange(i, { label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                placeholder={`Option ${i + 1}`}
                className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors duration-200 cursor-pointer"
                aria-label="Remove option"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addOption}
            className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 transition-colors duration-200 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add option
          </button>
        </div>
      )}
    </div>
  )
}
