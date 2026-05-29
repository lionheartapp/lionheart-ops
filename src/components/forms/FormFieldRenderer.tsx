'use client'

import { Checkbox } from '@/components/ui/Checkbox'
import { FileInput, SelectedFileChip } from '@/components/ui/FileInput'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
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
  inputId?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FormFieldRenderer({
  field,
  value,
  onChange,
  disabled = false,
  inputId,
}: FormFieldRendererProps) {
  const t = field.type

  if (t === 'TEXT' || t === 'EMAIL' || t === 'PHONE') {
    const inputType = t === 'EMAIL' ? 'email' : t === 'PHONE' ? 'tel' : 'text'
    return (
      <Input
        id={inputId}
        type={inputType}
        placeholder={field.placeholder || ''}
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    )
  }

  if (t === 'TEXTAREA') {
    return (
      <Textarea
        id={inputId}
        rows={3}
        placeholder={field.placeholder || ''}
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    )
  }

  if (t === 'NUMBER') {
    return (
      <Input
        id={inputId}
        type="number"
        placeholder={field.placeholder || ''}
        value={(value as string | number) ?? ''}
        onChange={(e) =>
          onChange(e.target.value === '' ? '' : Number(e.target.value))
        }
        disabled={disabled}
      />
    )
  }

  if (t === 'DATE') {
    return (
      <Input
        id={inputId}
        type="date"
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    )
  }

  if (t === 'DROPDOWN') {
    return (
      <Select
        value={(value as string) ?? ''}
        onChange={onChange}
        options={[
          { value: '', label: field.placeholder || 'Select...' },
          ...(field.options || []).map((o) => ({ value: o, label: o })),
        ]}
        disabled={disabled}
      />
    )
  }

  if (t === 'MULTI_SELECT') {
    const selected = Array.isArray(value) ? (value as string[]) : []
    return (
      <div className="space-y-1.5">
        {(field.options || []).map((o) => (
          <Checkbox
            key={o}
            checked={selected.includes(o)}
            disabled={disabled}
            onChange={(e) => {
              const next = e.target.checked
                ? [...selected, o]
                : selected.filter((s) => s !== o)
              onChange(next)
            }}
            label={o}
          />
        ))}
      </div>
    )
  }

  if (t === 'CHECKBOX') {
    return (
      <Checkbox
        checked={!!value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        label={field.checkboxLabel || 'Yes'}
      />
    )
  }

  if (t === 'FILE') {
    const selectedFileName = typeof value === 'string' && value ? value : null
    return (
      <div className="space-y-2">
        <FileInput
          disabled={disabled}
          compact
          onFiles={(files) => onChange(files[0]?.name ?? null)}
        />
        {selectedFileName && (
          <SelectedFileChip
            file={{ name: selectedFileName }}
            onRemove={disabled ? undefined : () => onChange(null)}
          />
        )}
      </div>
    )
  }

  // Placeholder renders for special field types (will be fully implemented in later phases)
  if (t === 'SIGNATURE') {
    return (
      <div className="flex h-24 w-full items-center justify-center rounded-field border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-400">
        Signature pad - available after form submission
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
      <Select
        value={(value as string) ?? ''}
        onChange={onChange}
        options={[{ value: '', label: `${labels[t]}...` }]}
        disabled={disabled}
      />
    )
  }

  if (t === 'GRADE_SELECTOR') {
    const grades = ['Pre-K', 'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
    return (
      <Select
        value={(value as string) ?? ''}
        onChange={onChange}
        options={[
          { value: '', label: 'Select grade...' },
          ...grades.map((g) => ({ value: g, label: g })),
        ]}
        disabled={disabled}
      />
    )
  }

  return (
    <div className="text-xs text-red-600">Unknown field type: {t}</div>
  )
}
