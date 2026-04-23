'use client'

import { useState, useCallback, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useOptimisticMutation } from '@/lib/hooks/useOptimisticMutation'
import { FileText, Lock } from 'lucide-react'
import { fetchApi, getAuthHeaders } from '@/lib/api-client'
import { SortableList, FieldEditor, AddFieldButton } from '@/components/forms'
import type { FormFieldData } from '@/components/forms'
import {
  STANDARD_TICKET_FIELDS,
  slugifyFieldKey,
  getFieldTypeMeta,
  type FormFieldType,
} from '@/lib/forms/schemas'
import { useToast } from '@/components/Toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormDefinitionResponse {
  id: string
  categoryKey: string | null
  fields: FormFieldData[]
}

interface CategoryFormEditorProps {
  categoryKey: string
  categoryLabel: string
  module: 'IT' | 'MAINTENANCE'
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CategoryFormEditor({
  categoryKey,
  categoryLabel,
  module,
}: CategoryFormEditorProps) {
  const queryClient = useQueryClient()
  const { toast: addToast } = useToast()
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch form definition (auto-seeds on first GET)
  const { data: formDef, isLoading } = useQuery({
    queryKey: ['form-definition', 'category', categoryKey],
    queryFn: () =>
      fetchApi<FormDefinitionResponse>(
        `/api/forms/category/${categoryKey}`
      ),
 })

  // Save mutation (debounced via full field replacement)
  const saveMutation = useOptimisticMutation<unknown, FormFieldData[], unknown>({
    queryKey: ['form-definition', 'category', categoryKey],
    mutationFn: async (fields) => {
      if (!formDef?.id) return
      const body = {
        fields: fields.map((f, i) => ({
          id: f.id,
          key: f.key,
          label: f.label,
          type: f.type,
          required: f.required,
          placeholder: f.placeholder ?? null,
          helpText: f.helpText ?? null,
          options: f.options ?? [],
          autoEscalate: f.autoEscalate ?? false,
          condFieldKey: f.condFieldKey ?? null,
          condEquals: f.condEquals ?? null,
          sortOrder: i,
          sectionId: null,
       })),
     }
      const res = await fetch(`/api/forms/category/${categoryKey}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
       },
        body: JSON.stringify(body),
     })
      if (!res.ok) throw new Error('Failed to save')
      return res.json()
   },
    onSuccess: () => addToast('Form saved', 'success'),
    onError: () => addToast('Failed to save form', 'error'),
 })

  // Debounced auto-save
  const debouncedSave = useCallback(
    (fields: FormFieldData[]) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(() => {
        saveMutation.mutate(fields)
     }, 800)
   },
    [saveMutation]
  )

  // Local field state for optimistic editing
  const [localFields, setLocalFields] = useState<FormFieldData[] | null>(null)
  const fields = localFields ?? formDef?.fields ?? []

  function updateFields(next: FormFieldData[]) {
    setLocalFields(next)
    debouncedSave(next)
 }

  function handleFieldChange(index: number, updated: FormFieldData) {
    const next = fields.map((f, i) => (i === index ? updated : f))
    updateFields(next)
 }

  function handleFieldRemove(index: number) {
    const next = fields.filter((_, i) => i !== index)
    updateFields(next)
 }

  function handleReorder(reordered: FormFieldData[]) {
    updateFields(reordered)
 }

  function handleAddField(type: FormFieldType) {
    const meta = getFieldTypeMeta(type)
    const newField: FormFieldData = {
      key: `field_${Date.now().toString(36)}`,
      label: meta.label,
      type,
      required: false,
      placeholder: null,
      helpText: null,
      options: type === 'DROPDOWN' || type === 'MULTI_SELECT'
        ? ['Option 1', 'Option 2']
        : [],
      autoEscalate: false,
      condFieldKey: null,
      condEquals: null,
   }
    updateFields([...fields, newField])
 }

  // Build condition candidates (standard fields + dropdown custom fields)
  const conditionCandidates = [
    ...STANDARD_TICKET_FIELDS
      .filter((f) => f.options)
      .map((f) => ({ key: f.key, label: f.label, options: f.options })),
    ...fields
      .filter((f) => f.type === 'DROPDOWN' || f.type === 'MULTI_SELECT')
      .map((f) => ({ key: f.key, label: f.label, options: f.options })),
  ]

  // ─── Skeleton loading ─────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-3 mt-6">
        <div className="h-4 w-40 bg-[#f5f4f0] rounded animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 rounded-2xl bg-[#f5f4f0] animate-pulse"
            />
          ))}
        </div>
      </div>
    )
 }

  return (
    <div className="mt-6">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#a8a49d]" />
          <span className="text-xs font-semibold uppercase tracking-wide text-[#6a6864]">
            {categoryLabel} Form Fields
          </span>
        </div>
        <span className="text-[11px] text-[#a8a49d]">
          {saveMutation.isPending ? 'Saving\u2026' : 'Auto-saves'}
        </span>
      </div>

      {/* Standard fields (locked, read-only) */}
      <div className="rounded-2xl border border-[rgba(17,15,10,0.06)] bg-[#fafaf9] divide-y divide-[rgba(17,15,10,0.05)] mb-3">
        {STANDARD_TICKET_FIELDS.map((f) => (
          <div
            key={f.key}
            className="flex items-center justify-between px-4 py-2.5"
          >
            <div>
              <div className="text-sm text-[#1a1915]">
                {f.label}
                {f.required && (
                  <span className="text-red-500 ml-0.5">*</span>
                )}
              </div>
              <div className="text-xs text-[#a8a49d]">
                {getFieldTypeMeta(f.type).label}
              </div>
            </div>
            <div className="flex items-center gap-1 text-[#a8a49d]">
              <Lock className="w-3 h-3" />
              <span className="text-[10px] uppercase tracking-wide">
                Always shown
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Custom fields (sortable) */}
      {fields.length === 0 ? (
        <div className="text-sm text-[#a8a49d] rounded-2xl border border-dashed border-[rgba(17,15,10,0.1)] px-4 py-6 text-center mb-3">
          No extra fields yet — submitters see only the standard ones.
        </div>
      ) : (
        <SortableList
          items={fields}
          keyFn={(f) => f.id ?? f.key}
          onReorder={handleReorder}
          renderItem={(field, index, { listeners, attributes }) => (
            <FieldEditor
              field={field}
              allFields={fields}
              onChange={(next) => handleFieldChange(index, next)}
              onRemove={() => handleFieldRemove(index)}
              dragListeners={listeners}
              dragAttributes={attributes}
              conditionCandidates={conditionCandidates}
            />
          )}
          className="space-y-2 mb-3"
        />
      )}

      <AddFieldButton onAdd={handleAddField} />
    </div>
  )
}
