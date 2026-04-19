'use client'

import FormFieldRenderer, { type FormFieldData } from './FormFieldRenderer'
import { getFieldTypeMeta } from '@/lib/forms/schemas'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormRendererProps {
  fields: FormFieldData[]
  responses: Record<string, unknown>
  setResponses: (next: Record<string, unknown>) => void
  disabledKeys?: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shouldShowField(
  field: FormFieldData,
  responses: Record<string, unknown>
): boolean {
  if (!field.condFieldKey || field.condEquals == null) return true
  return String(responses[field.condFieldKey] ?? '') === String(field.condEquals)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FormRenderer({
  fields,
  responses,
  setResponses,
  disabledKeys = [],
}: FormRendererProps) {
  return (
    <div className="space-y-4">
      {fields.map((f) => {
        if (!shouldShowField(f, responses)) return null
        const disabled = disabledKeys.includes(f.key)
        const meta = getFieldTypeMeta(f.type)

        return (
          <div key={f.id || f.key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[#1a1915]">
                {f.label}
                {f.required && (
                  <span className="text-red-500 ml-0.5">*</span>
                )}
              </label>
              <span className="text-[10px] uppercase tracking-wide text-[#a8a49d]">
                {meta.label}
              </span>
            </div>
            <FormFieldRenderer
              field={f}
              value={responses[f.key]}
              disabled={disabled}
              onChange={(v) =>
                setResponses({ ...responses, [f.key]: v })
              }
            />
            {f.helpText && (
              <div className="text-xs text-[#6a6864]">{f.helpText}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export { shouldShowField }
