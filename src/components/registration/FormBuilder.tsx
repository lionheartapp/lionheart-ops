'use client'

import { useState, useEffect, useCallback } from 'react'
import { Save, Plus, Settings, Loader2, DollarSign, Users, Clock, Tag } from 'lucide-react'
import {
  useRegistrationForm,
  useUpdateRegistrationForm,
  type FormSection,
  type FormField,
  type FormConfig,
  type DiscountCode,
} from '@/lib/hooks/useRegistrationForm'
import { CommonFieldPicker, COMMON_FIELDS } from './CommonFieldPicker'
import { SectionEditor } from './SectionEditor'
import { useToast } from '@/components/Toast'

// ─── Props ─────────────────────────────────────────────────────────────────────

interface FormBuilderProps {
  eventProjectId: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getEnabledCommonKeys(sections: FormSection[]): Set<string> {
  const keys = new Set<string>()
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.fieldType === 'COMMON' && field.fieldKey) {
        keys.add(field.fieldKey)
      }
    }
  }
  return keys
}

function buildCommonField(key: string, sortOrder: number): FormField {
  const def = COMMON_FIELDS.find((f) => f.key === key)
  return {
    fieldType: 'COMMON',
    fieldKey: key,
    inputType: (def?.inputType ?? 'TEXT') as FormField['inputType'],
    label: def?.label ?? key,
    helpText: null,
    placeholder: null,
    required: def?.required ?? false,
    enabled: true,
    options: null,
    sortOrder,
  }
}

// ─── Form Settings Panel ───────────────────────────────────────────────────────

interface FormSettingsPanelProps {
  config: FormConfig
  onChange: (patch: Partial<FormConfig>) => void
}

function FormSettingsPanel({ config, onChange }: FormSettingsPanelProps) {
  const [newCode, setNewCode] = useState('')
  const [newPercent, setNewPercent] = useState('')

  function addDiscountCode() {
    const code = newCode.trim().toUpperCase()
    const percent = parseFloat(newPercent)
    if (!code) return
    const existing = config.discountCodes ?? []
    const updated: DiscountCode[] = [
      ...existing,
      { code, percentOff: isNaN(percent) ? null : percent, amountOff: null, maxUses: null, usedCount: 0 },
    ]
    onChange({ discountCodes: updated })
    setNewCode('')
    setNewPercent('')
  }

  function removeDiscountCode(index: number) {
    const updated = (config.discountCodes ?? []).filter((_, i) => i !== index)
    onChange({ discountCodes: updated })
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center gap-2">
        <Settings className="w-4 h-4 text-slate-500" />
        <span className="text-sm font-semibold text-slate-700">Form Settings</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Payment */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 cursor-pointer">
              <DollarSign className="w-4 h-4 text-slate-400" />
              Requires Payment
            </label>
            <button
              type="button"
              role="switch"
              aria-checked={config.requiresPayment}
              onClick={() => onChange({ requiresPayment: !config.requiresPayment })}
              className={`relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors duration-200 cursor-pointer ${
                config.requiresPayment ? 'bg-indigo-600' : 'bg-slate-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
                  config.requiresPayment ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {config.requiresPayment && (
            <div className="space-y-2 mt-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Base Price ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={config.basePrice != null ? (config.basePrice / 100).toFixed(2) : ''}
                  onChange={(e) => {
                    const dollars = parseFloat(e.target.value)
                    onChange({ basePrice: isNaN(dollars) ? null : Math.round(dollars * 100) })
                  }}
                  placeholder="0.00"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Deposit % (optional)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={config.depositPercent ?? ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value)
                    onChange({ depositPercent: isNaN(val) ? null : val })
                  }}
                  placeholder="Leave blank to require full payment"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            </div>
          )}
        </div>

        {/* Capacity */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Users className="w-4 h-4 text-slate-400" />
            <label className="text-sm font-medium text-slate-700">Max Capacity (optional)</label>
          </div>
          <input
            type="number"
            min="1"
            value={config.maxCapacity ?? ''}
            onChange={(e) => {
              const val = parseInt(e.target.value)
              onChange({ maxCapacity: isNaN(val) ? null : val })
            }}
            placeholder="Unlimited"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />

          {/* Waitlist toggle */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-slate-600">Enable Waitlist</span>
            <button
              type="button"
              role="switch"
              aria-checked={config.waitlistEnabled}
              onClick={() => onChange({ waitlistEnabled: !config.waitlistEnabled })}
              className={`relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors duration-200 cursor-pointer ${
                config.waitlistEnabled ? 'bg-indigo-600' : 'bg-slate-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
                  config.waitlistEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* COPPA consent */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Require COPPA Consent</span>
          <button
            type="button"
            role="switch"
            aria-checked={config.requiresCoppaConsent}
            onClick={() => onChange({ requiresCoppaConsent: !config.requiresCoppaConsent })}
            className={`relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors duration-200 cursor-pointer ${
              config.requiresCoppaConsent ? 'bg-indigo-600' : 'bg-slate-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
                config.requiresCoppaConsent ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Open / close dates */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">Registration Window</span>
          </div>
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Opens at</label>
              <input
                type="datetime-local"
                value={config.openAt ? config.openAt.slice(0, 16) : ''}
                onChange={(e) => onChange({ openAt: e.target.value ? `${e.target.value}:00Z` : null })}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Closes at</label>
              <input
                type="datetime-local"
                value={config.closeAt ? config.closeAt.slice(0, 16) : ''}
                onChange={(e) => onChange({ closeAt: e.target.value ? `${e.target.value}:00Z` : null })}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>
        </div>

        {/* Discount codes */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Tag className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">Discount Codes</span>
          </div>

          {(config.discountCodes ?? []).length > 0 && (
            <div className="space-y-1 mb-2">
              {(config.discountCodes ?? []).map((dc, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-1.5 text-sm">
                  <span className="font-mono font-medium text-slate-700">{dc.code}</span>
                  <div className="flex items-center gap-2">
                    {dc.percentOff != null && (
                      <span className="text-xs text-green-700 bg-green-100 px-1.5 py-0.5 rounded">
                        {dc.percentOff}% off
                      </span>
                    )}
                    <span className="text-xs text-slate-500">{dc.usedCount} uses</span>
                    <button
                      type="button"
                      onClick={() => removeDiscountCode(i)}
                      className="text-slate-400 hover:text-red-500 transition-colors duration-200 cursor-pointer text-xs"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              placeholder="CODE"
              className="w-24 text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
            />
            <input
              type="number"
              value={newPercent}
              onChange={(e) => setNewPercent(e.target.value)}
              placeholder="% off"
              min="0"
              max="100"
              className="w-20 text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              type="button"
              onClick={addDiscountCode}
              disabled={!newCode.trim()}
              className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main FormBuilder ──────────────────────────────────────────────────────────

export function FormBuilder({ eventProjectId }: FormBuilderProps) {
  const { data: formData, isLoading } = useRegistrationForm(eventProjectId)
  const updateMutation = useUpdateRegistrationForm(eventProjectId)
  const { toast } = useToast()

  const [sections, setSections] = useState<FormSection[]>([])
  const [formConfig, setFormConfig] = useState<Partial<FormConfig>>({})
  const [initialized, setInitialized] = useState(false)

  // Initialize local state from server data
  useEffect(() => {
    if (formData && !initialized) {
      setSections(formData.sections ?? [])
      if (formData.form) {
        setFormConfig({
          requiresPayment: formData.form.requiresPayment,
          basePrice: formData.form.basePrice,
          depositPercent: formData.form.depositPercent,
          maxCapacity: formData.form.maxCapacity,
          waitlistEnabled: formData.form.waitlistEnabled,
          requiresCoppaConsent: formData.form.requiresCoppaConsent,
          openAt: formData.form.openAt,
          closeAt: formData.form.closeAt,
          discountCodes: formData.form.discountCodes,
        })
      }
      setInitialized(true)
    }
  }, [formData, initialized])

  const enabledKeys = getEnabledCommonKeys(sections)

  const handleCommonFieldToggle = useCallback(
    (key: string, enabled: boolean) => {
      setSections((prev) => {
        if (enabled) {
          // Add to first section (or create "Participant Information")
          let target = prev[0]
          if (!target) {
            target = { title: 'Participant Information', description: null, sortOrder: 0, fields: [] }
          }
          const newField = buildCommonField(key, target.fields.length)
          const updatedTarget = { ...target, fields: [...target.fields, newField] }

          if (prev.length === 0) {
            return [updatedTarget]
          }
          return prev.map((s, i) => (i === 0 ? updatedTarget : s))
        } else {
          // Remove from whichever section it's in
          return prev.map((s) => ({
            ...s,
            fields: s.fields
              .filter((f) => !(f.fieldType === 'COMMON' && f.fieldKey === key))
              .map((f, i) => ({ ...f, sortOrder: i })),
          }))
        }
      })
    },
    []
  )

  function addSection() {
    const newSection: FormSection = {
      title: `Section ${sections.length + 1}`,
      description: null,
      sortOrder: sections.length,
      fields: [],
    }
    setSections((prev) => [...prev, newSection])
  }

  function handleSectionChange(index: number, updated: FormSection) {
    setSections((prev) => prev.map((s, i) => (i === index ? updated : s)))
  }

  function removeSection(index: number) {
    setSections((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, sortOrder: i }))
    )
  }

  function moveSectionUp(index: number) {
    if (index === 0) return
    setSections((prev) => {
      const updated = [...prev]
      const temp = updated[index - 1]
      updated[index - 1] = { ...updated[index], sortOrder: index - 1 }
      updated[index] = { ...temp, sortOrder: index }
      return updated
    })
  }

  function moveSectionDown(index: number) {
    if (index === sections.length - 1) return
    setSections((prev) => {
      const updated = [...prev]
      const temp = updated[index + 1]
      updated[index + 1] = { ...updated[index], sortOrder: index + 1 }
      updated[index] = { ...temp, sortOrder: index }
      return updated
    })
  }

  async function handleSave() {
    try {
      await updateMutation.mutateAsync({
        form: formConfig,
        sections: sections.map((s, si) => ({
          ...s,
          sortOrder: si,
          fields: s.fields.map((f, fi) => ({ ...f, sortOrder: fi })),
        })),
      })
      toast('Registration form saved', 'success')
    } catch {
      toast('Failed to save form — please try again', 'error')
    }
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-100 rounded-xl w-48" />
        <div className="h-32 bg-slate-100 rounded-xl" />
        <div className="h-32 bg-slate-100 rounded-xl" />
      </div>
    )
  }

  const fullConfig: FormConfig = {
    id: formData?.form?.id ?? '',
    title: formData?.form?.title ?? null,
    shareSlug: formData?.form?.shareSlug ?? '',
    requiresPayment: (formConfig.requiresPayment as boolean | undefined) ?? false,
    basePrice: (formConfig.basePrice as number | null | undefined) ?? null,
    depositPercent: (formConfig.depositPercent as number | null | undefined) ?? null,
    maxCapacity: (formConfig.maxCapacity as number | null | undefined) ?? null,
    waitlistEnabled: (formConfig.waitlistEnabled as boolean | undefined) ?? false,
    requiresCoppaConsent: (formConfig.requiresCoppaConsent as boolean | undefined) ?? false,
    openAt: (formConfig.openAt as string | null | undefined) ?? null,
    closeAt: (formConfig.closeAt as string | null | undefined) ?? null,
    discountCodes: (formConfig.discountCodes as DiscountCode[] | null | undefined) ?? null,
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Registration Form Builder</h2>
        <button
          type="button"
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {updateMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Form
        </button>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Section editors (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          {sections.length === 0 && (
            <div className="text-center py-10 bg-white border border-dashed border-slate-200 rounded-xl">
              <p className="text-sm text-slate-500 mb-3">No sections yet. Add a section or toggle on common fields to get started.</p>
            </div>
          )}

          {sections.map((section, i) => (
            <SectionEditor
              key={section.id ?? `section-${i}`}
              section={section}
              onChange={(updated) => handleSectionChange(i, updated)}
              onRemove={() => removeSection(i)}
              onMoveUp={() => moveSectionUp(i)}
              onMoveDown={() => moveSectionDown(i)}
              canMoveUp={i > 0}
              canMoveDown={i < sections.length - 1}
            />
          ))}

          <button
            type="button"
            onClick={addSection}
            className="flex items-center gap-2 w-full px-4 py-3 rounded-xl border-2 border-dashed border-slate-200 text-sm text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/20 transition-colors duration-200 cursor-pointer font-medium justify-center"
          >
            <Plus className="w-4 h-4" />
            Add Section
          </button>
        </div>

        {/* Right: Common fields + settings (1/3) */}
        <div className="space-y-6">
          <CommonFieldPicker
            enabledKeys={enabledKeys}
            onToggle={handleCommonFieldToggle}
          />
          <FormSettingsPanel
            config={fullConfig}
            onChange={(patch) => setFormConfig((prev) => ({ ...prev, ...patch }))}
          />
        </div>
      </div>
    </div>
  )
}
