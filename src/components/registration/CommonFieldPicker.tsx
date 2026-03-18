'use client'

import { Shield } from 'lucide-react'

// ─── Common field definitions ──────────────────────────────────────────────────

interface CommonFieldDef {
  key: string
  label: string
  inputType: 'TEXT' | 'DROPDOWN' | 'FILE'
  required: boolean
  alwaysOn?: boolean
  isMedical?: boolean
}

export const COMMON_FIELDS: CommonFieldDef[] = [
  { key: 'first_name', label: 'First Name', inputType: 'TEXT', required: true, alwaysOn: true },
  { key: 'last_name', label: 'Last Name', inputType: 'TEXT', required: true, alwaysOn: true },
  { key: 'email', label: 'Parent Email', inputType: 'TEXT', required: true, alwaysOn: true },
  { key: 'phone', label: 'Phone Number', inputType: 'TEXT', required: false },
  { key: 'grade', label: 'Grade Level', inputType: 'DROPDOWN', required: false },
  { key: 'emergency_contact_name', label: 'Emergency Contact Name', inputType: 'TEXT', required: false, isMedical: true },
  { key: 'emergency_contact_phone', label: 'Emergency Contact Phone', inputType: 'TEXT', required: false, isMedical: true },
  { key: 'emergency_contact_relationship', label: 'Emergency Contact Relationship', inputType: 'TEXT', required: false, isMedical: true },
  { key: 'dietary_needs', label: 'Dietary Needs', inputType: 'TEXT', required: false, isMedical: true },
  { key: 'allergies', label: 'Allergies', inputType: 'TEXT', required: false, isMedical: true },
  { key: 'medications', label: 'Current Medications', inputType: 'TEXT', required: false, isMedical: true },
  { key: 'medical_notes', label: 'Medical Notes', inputType: 'TEXT', required: false, isMedical: true },
  { key: 'tshirt_size', label: 'T-Shirt Size', inputType: 'DROPDOWN', required: false },
  { key: 'photo', label: 'Student Photo', inputType: 'FILE', required: false },
]

// ─── Input type badge ──────────────────────────────────────────────────────────

const INPUT_TYPE_LABELS: Record<string, string> = {
  TEXT: 'Text',
  DROPDOWN: 'Dropdown',
  FILE: 'File',
}

function InputTypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
      {INPUT_TYPE_LABELS[type] ?? type}
    </span>
  )
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface CommonFieldPickerProps {
  enabledKeys: Set<string>
  onToggle: (key: string, enabled: boolean) => void
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function CommonFieldPicker({ enabledKeys, onToggle }: CommonFieldPickerProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Common Fields</h3>
      <div className="grid grid-cols-1 gap-2">
        {COMMON_FIELDS.map((field) => {
          const isEnabled = field.alwaysOn || enabledKeys.has(field.key)
          const isDisabled = field.alwaysOn === true

          return (
            <div
              key={field.key}
              className={`ui-glass p-3 rounded-xl flex items-start gap-3 transition-colors duration-200 ${
                isEnabled ? 'bg-white' : 'bg-slate-50/60'
              }`}
            >
              {/* Toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={isEnabled}
                disabled={isDisabled}
                onClick={() => !isDisabled && onToggle(field.key, !isEnabled)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 mt-0.5 ${
                  isEnabled ? 'bg-indigo-600' : 'bg-slate-200'
                } ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                    isEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>

              {/* Field info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-medium ${isEnabled ? 'text-slate-900' : 'text-slate-500'}`}>
                    {field.label}
                  </span>
                  {field.required && (
                    <span className="text-xs text-red-500 font-medium">Required</span>
                  )}
                  <InputTypeBadge type={field.inputType} />
                </div>
                {field.isMedical && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Shield className="w-3 h-3 text-amber-500" />
                    <span className="text-xs text-amber-600">FERPA-protected</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
