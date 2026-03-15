'use client'

import { useState } from 'react'
import { Trash2, ChevronUp, ChevronDown, Plus, ChevronDownIcon } from 'lucide-react'
import type { FormSection, FormField } from '@/lib/hooks/useRegistrationForm'
import { FormFieldEditor } from './FormFieldEditor'

// ─── Props ─────────────────────────────────────────────────────────────────────

interface SectionEditorProps {
  section: FormSection
  onChange: (section: FormSection) => void
  onRemove: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function SectionEditor({
  section,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: SectionEditorProps) {
  const [showDescription, setShowDescription] = useState(!!section.description)
  const [confirmRemove, setConfirmRemove] = useState(false)

  function update(patch: Partial<FormSection>) {
    onChange({ ...section, ...patch })
  }

  function handleFieldChange(index: number, updated: FormField) {
    const fields = section.fields.map((f, i) => (i === index ? updated : f))
    update({ fields })
  }

  function addCustomField() {
    const newField: FormField = {
      fieldType: 'CUSTOM',
      fieldKey: null,
      inputType: 'TEXT',
      label: '',
      helpText: null,
      placeholder: null,
      required: false,
      enabled: true,
      options: null,
      sortOrder: section.fields.length,
    }
    update({ fields: [...section.fields, newField] })
  }

  function removeField(index: number) {
    const fields = section.fields
      .filter((_, i) => i !== index)
      .map((f, i) => ({ ...f, sortOrder: i }))
    update({ fields })
  }

  function handleRemoveConfirm() {
    if (confirmRemove) {
      onRemove()
    } else {
      setConfirmRemove(true)
      // Auto-reset confirmation after 3s
      setTimeout(() => setConfirmRemove(false), 3000)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Section header */}
      <div className="bg-gray-50 px-4 py-3 flex items-center gap-3 border-b border-gray-200">
        {/* Title input */}
        <div className="flex-1">
          <input
            type="text"
            value={section.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="Section name"
            className="w-full text-sm font-semibold text-gray-800 bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-gray-400"
          />
        </div>

        {/* Move buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className={`p-1.5 rounded-lg transition-colors duration-200 ${
              canMoveUp
                ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 cursor-pointer'
                : 'text-gray-300 cursor-not-allowed'
            }`}
            aria-label="Move section up"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className={`p-1.5 rounded-lg transition-colors duration-200 ${
              canMoveDown
                ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 cursor-pointer'
                : 'text-gray-300 cursor-not-allowed'
            }`}
            aria-label="Move section down"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* Remove button */}
        <button
          type="button"
          onClick={handleRemoveConfirm}
          className={`p-1.5 rounded-lg transition-colors duration-200 cursor-pointer text-sm ${
            confirmRemove
              ? 'bg-red-100 text-red-600 font-medium px-2'
              : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
          }`}
          aria-label="Remove section"
        >
          {confirmRemove ? 'Confirm?' : <Trash2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Section body */}
      <div className="p-4 space-y-3">
        {/* Description */}
        <div>
          <button
            type="button"
            onClick={() => setShowDescription(!showDescription)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors duration-200 cursor-pointer mb-2"
          >
            <ChevronDownIcon className={`w-3 h-3 transition-transform ${showDescription ? 'rotate-180' : ''}`} />
            Section description (optional)
          </button>
          {showDescription && (
            <textarea
              value={section.description ?? ''}
              onChange={(e) => update({ description: e.target.value || null })}
              placeholder="Brief description displayed above the fields in this section"
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
          )}
        </div>

        {/* Fields */}
        {section.fields.length > 0 && (
          <div className="space-y-2">
            {section.fields.map((field, i) => (
              <FormFieldEditor
                key={field.id ?? `new-${i}`}
                field={field}
                onChange={(updated) => handleFieldChange(i, updated)}
                onRemove={() => removeField(i)}
              />
            ))}
          </div>
        )}

        {/* Add custom field */}
        <button
          type="button"
          onClick={addCustomField}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-dashed border-gray-300 text-sm text-gray-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors duration-200 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Custom Field
        </button>
      </div>
    </div>
  )
}
