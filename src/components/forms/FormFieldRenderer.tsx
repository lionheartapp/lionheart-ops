'use client'

import type { FormFieldType } from '@/lib/forms/schemas'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FormFieldData {
  id?: string
  key: string
  label: string
  type: FormFieldType
  required: boolean
  placeholder?: string | null
  helpText?: string | null
  options?: string[]
  autoEscalate?: boolean
  condFieldKey?: string | null
  condEquals?: string | null
  checkboxLabel?: string
}

interface FormFieldRendererProps {
  field: FormFieldData
  value: unknown
  onChange: (value: unknown) => void
  disabled?: boolean
}

// ─── Shared input classes ─────────────────────────────────────────────────────

const baseInput = [
  'w-full rounded-xl border border-[rgba(17,15,10,0.1)] bg-white',
  'px-3 py-2.5 text-sm text-[#1a1915]',
  'placeholder:text-[#a8a49d]',
  'focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/20 focus:outline-none',
  'transition-colors duration-200',
  'disabled:bg-[#fafaf9] disabled:text-[#a8a49d]',
].join(' ')

// ─── Component ────────────────────────────────────────────────────────────────

export default function FormFieldRenderer({
  field,
  value,
  onChange,
  disabled = false,
}: FormFieldRendererProps) {
  const t = field.type

  if (t === 'TEXT' || t === 'EMAIL' || t === 'PHONE') {
    const inputType = t === 'EMAIL' ? 'email' : t === 'PHONE' ? 'tel' : 'text'
    return (
      <input
        type={inputType}
        className={baseInput}
        placeholder={field.placeholder || ''}
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    )
  }

  if (t === 'TEXTAREA') {
    return (
      <textarea
        rows={3}
        className={baseInput}
        placeholder={field.placeholder || ''}
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    )
  }

  if (t === 'NUMBER') {
    return (
      <input
        type="number"
        className={baseInput}
        placeholder={field.placeholder || ''}
        value={(value as string) ?? ''}
        onChange={(e) =>
          onChange(e.target.value === '' ? '' : Number(e.target.value))
        }
        disabled={disabled}
      />
    )
  }

  if (t === 'DATE') {
    return (
      <input
        type="date"
        className={baseInput}
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    )
  }

  if (t === 'DROPDOWN') {
    return (
      <select
        className={`${baseInput} cursor-pointer`}
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">{field.placeholder || 'Select\u2026'}</option>
        {(field.options || []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    )
  }

  if (t === 'MULTI_SELECT') {
    const selected = Array.isArray(value) ? (value as string[]) : []
    return (
      <div className="space-y-1.5">
        {(field.options || []).map((o) => (
          <label key={o} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[rgba(17,15,10,0.15)] text-blue-500 focus:ring-blue-400/40 cursor-pointer"
              checked={selected.includes(o)}
              disabled={disabled}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...selected, o]
                  : selected.filter((s) => s !== o)
                onChange(next)
              }}
            />
            <span className="text-sm text-[#1a1915]">{o}</span>
          </label>
        ))}
      </div>
    )
  }

  if (t === 'CHECKBOX') {
    return (
      <label className="inline-flex items-center gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-[rgba(17,15,10,0.15)] text-blue-500 focus:ring-blue-400/40 cursor-pointer"
          checked={!!value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="text-sm text-[#1a1915]">
          {field.checkboxLabel || 'Yes'}
        </span>
      </label>
    )
  }

  if (t === 'FILE') {
    return (
      <div className={`${baseInput} flex items-center gap-2`}>
        <input
          type="file"
          className="text-sm text-[#6a6864] file:mr-3 file:rounded-full file:border-0 file:bg-[#f5f4f0] file:px-3 file:py-1 file:text-sm file:font-medium file:text-[#1a1915] file:cursor-pointer hover:file:bg-[#eae8e2]"
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0]
            onChange(file?.name ?? null)
          }}
        />
      </div>
    )
  }

  // Placeholder renders for special field types (will be fully implemented in later phases)
  if (t === 'SIGNATURE') {
    return (
      <div className={`${baseInput} h-24 flex items-center justify-center text-[#a8a49d] text-sm`}>
        Signature pad — available after form submission
      </div>
    )
  }

  if (t === 'ASSET_PICKER' || t === 'USER_PICKER' || t === 'LOCATION_PICKER') {
    const labels: Record<string, string> = {
      ASSET_PICKER: 'Select a device or asset',
      USER_PICKER: 'Select a staff member',
      LOCATION_PICKER: 'Select a location',
    }
    return (
      <select
        className={`${baseInput} cursor-pointer`}
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">{labels[t]}\u2026</option>
      </select>
    )
  }

  if (t === 'GRADE_SELECTOR') {
    const grades = ['Pre-K', 'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
    return (
      <select
        className={`${baseInput} cursor-pointer`}
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">Select grade\u2026</option>
        {grades.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>
    )
  }

  return (
    <div className="text-xs text-red-600">Unknown field type: {t}</div>
  )
}
