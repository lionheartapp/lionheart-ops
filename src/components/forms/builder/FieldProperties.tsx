'use client'

import { useState } from 'react'
import {
  ChevronDown,
  Trash2,
  Lock,
  ShieldAlert,
} from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import {
  FIELD_TYPE_META,
  getFieldTypeMeta,
  FIELD_CATEGORY_LABELS,
  type FormFieldType,
} from '@/lib/forms/schemas'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import type { FormFieldData } from './FormBuilder'

interface FieldPropertiesProps {
  field: FormFieldData | null
  allFields: FormFieldData[]
  onUpdate: (patch: Partial<FormFieldData>) => void
  onRemove: () => void
  isSystemForm?: boolean
}

function getIcon(iconName: string, className = 'w-4 h-4') {
  const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>>)[iconName]
  return Icon ? <Icon className={className} strokeWidth={1.5} /> : null
}

// ─── Collapsible section ────────────────────────────────────────────────

function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:bg-slate-50 transition-colors cursor-pointer"
      >
        {title}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  )
}

// ─── Toggle ─────────────────────────────────────────────────────────────

function Toggle({
  label,
  checked,
  onChange,
  disabled,
  hint,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  hint?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-xs font-medium text-slate-700">{label}</span>
        {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`relative w-8 h-[18px] rounded-full transition-colors ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${checked ? 'bg-indigo-500' : 'bg-slate-200'}`}
      >
        <div
          className={`absolute top-[2px] w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[16px]' : 'translate-x-[2px]'
          }`}
        />
      </button>
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────────────────

export default function FieldProperties({
  field,
  allFields,
  onUpdate,
  onRemove,
  isSystemForm,
}: FieldPropertiesProps) {
  if (!field) {
    return (
      <div className="flex items-center justify-center h-full text-center px-6">
        <div>
          <LucideIcons.MousePointerClick className="w-8 h-8 text-slate-200 mx-auto mb-3" />
          <p className="text-xs text-slate-400">Select a field on the canvas to edit its properties.</p>
        </div>
      </div>
    )
  }

  const meta = getFieldTypeMeta(field.type)
  const isLocked = field.protection === 'LOCKED'
  const isDefault = field.protection === 'DEFAULT'
  const isLayout = field.type === 'HEADER' || field.type === 'DIVIDER'
  const hasOptions = field.type === 'DROPDOWN' || field.type === 'MULTI_SELECT' || field.type === 'RADIO'

  // Condition candidates — only dropdown/radio/checkbox fields
  const condCandidates = allFields.filter(
    (f) =>
      f.id !== field.id &&
      (f.type === 'DROPDOWN' || f.type === 'MULTI_SELECT' || f.type === 'RADIO' || f.type === 'CHECKBOX')
  )

  return (
    <div className="divide-y divide-slate-100">
      {/* Field type header */}
      <div className="px-4 py-3 flex items-center gap-2">
        <span className="text-slate-400">{getIcon(meta.icon, 'w-4 h-4')}</span>
        <span className="text-xs font-semibold text-slate-700">{meta.label}</span>
        {isLocked && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-slate-400">
            <Lock className="w-3 h-3" /> Locked
          </span>
        )}
        {isDefault && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-amber-500">
            <ShieldAlert className="w-3 h-3" /> Default
          </span>
        )}
      </div>

      {/* Basic */}
      <Section title="Basic" defaultOpen>
        {!isLayout && (
          <div>
            <label className="text-[10px] font-medium text-slate-500 mb-1 block">Label</label>
            <Input
              size="sm"
              value={field.label}
              onChange={(e) => onUpdate({ label: e.target.value })}
            />
          </div>
        )}

        {field.type === 'HEADER' && (
          <div>
            <label className="text-[10px] font-medium text-slate-500 mb-1 block">Heading Text</label>
            <Input
              size="sm"
              value={field.label}
              onChange={(e) => onUpdate({ label: e.target.value })}
            />
          </div>
        )}

        {!isLayout && (
          <div>
            <label className="text-[10px] font-medium text-slate-500 mb-1 block">Placeholder</label>
            <Input
              size="sm"
              value={field.placeholder ?? ''}
              onChange={(e) => onUpdate({ placeholder: e.target.value || null })}
            />
          </div>
        )}

        {!isLayout && (
          <div>
            <label className="text-[10px] font-medium text-slate-500 mb-1 block">Help Text</label>
            <Input
              size="sm"
              value={field.helpText ?? ''}
              onChange={(e) => onUpdate({ helpText: e.target.value || null })}
            />
          </div>
        )}

        {!isLayout && (
          <div>
            <label className="text-[10px] font-medium text-slate-500 mb-1 block">Default Value</label>
            <Input
              size="sm"
              value={field.defaultValue ?? ''}
              onChange={(e) => onUpdate({ defaultValue: e.target.value || null })}
            />
          </div>
        )}
      </Section>

      {/* Options (for choice fields) */}
      {hasOptions && (
        <Section title="Options" defaultOpen>
          <div className="space-y-1.5">
            {field.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Input
                  size="sm"
                  value={opt}
                  onChange={(e) => {
                    const next = [...field.options]
                    next[i] = e.target.value
                    onUpdate({ options: next })
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const next = field.options.filter((_, j) => j !== i)
                    onUpdate({ options: next })
                  }}
                  className="p-1 text-slate-300 hover:text-red-500 transition-colors cursor-pointer flex-shrink-0"
                >
                  <LucideIcons.X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => onUpdate({ options: [...field.options, ''] })}
              className="flex items-center gap-1 text-[10px] font-medium text-indigo-600 hover:text-indigo-700 cursor-pointer"
            >
              <LucideIcons.Plus className="w-3 h-3" /> Add option
            </button>
          </div>
        </Section>
      )}

      {/* Validation */}
      {!isLayout && (
        <Section title="Validation">
          <Toggle
            label="Required"
            checked={field.required}
            onChange={(v) => onUpdate({ required: v })}
            disabled={isLocked}
          />

          {(field.type === 'TEXT' || field.type === 'TEXTAREA' || field.type === 'EMAIL' || field.type === 'PHONE' || field.type === 'URL') && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-medium text-slate-500 mb-1 block">Min length</label>
                  <Input
                    size="sm"
                    type="number"
                    value={field.minValue ?? ''}
                    onChange={(e) => onUpdate({ minValue: e.target.value || null })}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-slate-500 mb-1 block">Max length</label>
                  <Input
                    size="sm"
                    type="number"
                    value={field.maxValue ?? ''}
                    onChange={(e) => onUpdate({ maxValue: e.target.value || null })}
                  />
                </div>
              </div>
            </>
          )}

          {field.type === 'NUMBER' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-medium text-slate-500 mb-1 block">Min value</label>
                <Input
                  size="sm"
                  type="number"
                  value={field.minValue ?? ''}
                  onChange={(e) => onUpdate({ minValue: e.target.value || null })}
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-slate-500 mb-1 block">Max value</label>
                <Input
                  size="sm"
                  type="number"
                  value={field.maxValue ?? ''}
                  onChange={(e) => onUpdate({ maxValue: e.target.value || null })}
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] font-medium text-slate-500 mb-1 block">Error message</label>
            <Input
              size="sm"
              value={field.errorMessage ?? ''}
              onChange={(e) => onUpdate({ errorMessage: e.target.value || null })}
              placeholder="Custom validation error..."
            />
          </div>
        </Section>
      )}

      {/* Visibility */}
      {!isLayout && (
        <Section title="Visibility">
          {isDefault && (
            <Toggle
              label="Included"
              checked={field.isIncluded}
              onChange={(v) => onUpdate({ isIncluded: v })}
              hint={!field.isIncluded ? 'This field is hidden from the form' : undefined}
            />
          )}

          {isSystemForm ? (
            // System forms — always internal, option to mark as FERPA
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-slate-700">FERPA Protected</span>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                    Restricts responses to authorized staff only (nurse, registrar, principal). Use for medical info, emergency contacts, grades, or IEP data.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdate({
                    sensitivityLevel: field.sensitivityLevel === 'FERPA_PROTECTED' ? 'INTERNAL' : 'FERPA_PROTECTED'
                  })}
                  className={`relative w-8 h-[18px] rounded-full transition-colors cursor-pointer flex-shrink-0 ml-3 ${
                    field.sensitivityLevel === 'FERPA_PROTECTED' ? 'bg-red-500' : 'bg-slate-200'
                  }`}
                >
                  <div className={`absolute top-[2px] w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${
                    field.sensitivityLevel === 'FERPA_PROTECTED' ? 'translate-x-[16px]' : 'translate-x-[2px]'
                  }`} />
                </button>
              </div>
              {field.sensitivityLevel === 'FERPA_PROTECTED' && (
                <div className="flex items-start gap-2 px-2.5 py-2 bg-red-50 border border-red-100 rounded-lg">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-[10px] text-red-700 leading-relaxed">
                    This field&apos;s responses will be hidden from staff without FERPA access. Only school nurses, registrars, principals, and super admins can view this data.
                  </p>
                </div>
              )}
            </div>
          ) : (
            // Custom forms — full sensitivity picker
            <div>
              <label className="text-[10px] font-medium text-slate-500 mb-1 block">Sensitivity</label>
              <div className="flex gap-1">
                {(['PUBLIC', 'INTERNAL', 'FERPA_PROTECTED'] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => onUpdate({ sensitivityLevel: level })}
                    className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded-md transition-colors cursor-pointer ${
                      field.sensitivityLevel === level
                        ? level === 'FERPA_PROTECTED'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-slate-900 text-white'
                        : 'text-slate-400 border border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    {level === 'PUBLIC' ? 'Public' : level === 'INTERNAL' ? 'Internal' : 'FERPA'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Conditional logic */}
          {condCandidates.length > 0 && (
            <div className="space-y-2">
              <label className="text-[10px] font-medium text-slate-500 block">Show when...</label>
              <select
                value={field.condFieldKey ?? ''}
                onChange={(e) =>
                  onUpdate({
                    condFieldKey: e.target.value || null,
                    condOperator: e.target.value ? 'equals' : null,
                    condEquals: null,
                  })
                }
                className="w-full h-8 text-xs border border-slate-200 rounded-lg px-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
              >
                <option value="">Always visible</option>
                {condCandidates.map((c) => (
                  <option key={c.id} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>

              {field.condFieldKey && (
                <>
                  <select
                    value={field.condOperator ?? 'equals'}
                    onChange={(e) => onUpdate({ condOperator: e.target.value })}
                    className="w-full h-8 text-xs border border-slate-200 rounded-lg px-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                  >
                    <option value="equals">equals</option>
                    <option value="not_equals">does not equal</option>
                    <option value="contains">contains</option>
                    <option value="is_empty">is empty</option>
                    <option value="is_filled">is filled</option>
                  </select>

                  {field.condOperator !== 'is_empty' && field.condOperator !== 'is_filled' && (
                    <Input
                      size="sm"
                      value={field.condEquals ?? ''}
                      onChange={(e) => onUpdate({ condEquals: e.target.value || null })}
                      placeholder="Value..."
                    />
                  )}
                </>
              )}
            </div>
          )}
        </Section>
      )}

      {/* File upload settings */}
      {field.type === 'FILE' && (
        <Section title="File Settings">
          <div>
            <label className="text-[10px] font-medium text-slate-500 mb-1 block">Allowed file types</label>
            <Input
              size="sm"
              value={(field.fileTypes ?? []).join(', ')}
              onChange={(e) =>
                onUpdate({
                  fileTypes: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="pdf, jpg, png"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-slate-500 mb-1 block">Max file size (MB)</label>
            <Input
              size="sm"
              type="number"
              value={field.maxFileSize ? String(field.maxFileSize / (1024 * 1024)) : ''}
              onChange={(e) => {
                const mb = parseFloat(e.target.value)
                onUpdate({ maxFileSize: mb > 0 ? Math.round(mb * 1024 * 1024) : null })
              }}
              placeholder="10"
            />
          </div>
        </Section>
      )}

      {/* Delete button */}
      {field.protection === 'CUSTOM' && (
        <div className="px-4 py-4">
          <button
            type="button"
            onClick={onRemove}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Field
          </button>
        </div>
      )}
    </div>
  )
}
