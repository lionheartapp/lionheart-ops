'use client'

import { useState, useCallback, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Check } from 'lucide-react'
import FormFieldRenderer from '../FormFieldRenderer'
import type { FormFieldData } from '../FormFieldRenderer'

// ─── Types ────────────────────────────────────────────────────────────────────

/** A page from the FormDefinition, with its fields attached */
export interface DynamicPage {
  id: string
  title: string
  description?: string | null
  sortOrder: number
  isOptional?: boolean
  condFieldKey?: string | null
  condOperator?: string | null
  condEquals?: string | null
  fields: DynamicField[]
}

/** A field from the FormDefinition — extends FormFieldData with protection info */
export interface DynamicField extends FormFieldData {
  protection?: 'LOCKED' | 'DEFAULT' | 'CUSTOM'
  isIncluded?: boolean
  condOperator?: string | null
  minValue?: string | null
  maxValue?: string | null
  pattern?: string | null
  errorMessage?: string | null
  defaultValue?: string | null
  pageId?: string | null
}

export interface DynamicFormRendererProps {
  /** All pages (ordered). If empty/null, renders all fields as a single page. */
  pages: DynamicPage[]
  /** Loose fields not assigned to a page (rendered on a virtual first page) */
  looseFields?: DynamicField[]
  /** Current form values keyed by field.key */
  values: Record<string, unknown>
  /** Called whenever a field value changes */
  onChange: (values: Record<string, unknown>) => void
  /** Called when the user submits the final page */
  onSubmit: (values: Record<string, unknown>) => void | Promise<void>
  /** Submit button loading state */
  isSubmitting?: boolean
  /** Submit button label (default: "Submit") */
  submitLabel?: string
  /** Field-level validation errors from parent (e.g. server-side) */
  externalErrors?: Record<string, string>
  /** Keys of fields that should be disabled */
  disabledKeys?: string[]
  /** Show a compact single-page layout (no stepper, no navigation) */
  singlePageMode?: boolean
}

// ─── Condition Evaluation ────────────────────────────────────────────────────

function evaluateCondition(
  condFieldKey: string | null | undefined,
  condOperator: string | null | undefined,
  condEquals: string | null | undefined,
  values: Record<string, unknown>
): boolean {
  if (!condFieldKey) return true

  const actual = values[condFieldKey]
  const actualStr = String(actual ?? '')
  const expected = String(condEquals ?? '')
  const op = condOperator || 'equals'

  switch (op) {
    case 'equals':
      return actualStr === expected
    case 'not_equals':
      return actualStr !== expected
    case 'contains':
      return actualStr.toLowerCase().includes(expected.toLowerCase())
    case 'greater_than':
      return Number(actualStr) > Number(expected)
    case 'less_than':
      return Number(actualStr) < Number(expected)
    case 'is_empty':
      return !actual || actualStr === ''
    case 'is_filled':
      return !!actual && actualStr !== ''
    default:
      return actualStr === expected
  }
}

function isFieldVisible(field: DynamicField, values: Record<string, unknown>): boolean {
  if (field.isIncluded === false) return false
  return evaluateCondition(field.condFieldKey, field.condOperator, field.condEquals, values)
}

function isPageVisible(page: DynamicPage, values: Record<string, unknown>): boolean {
  return evaluateCondition(page.condFieldKey, page.condOperator, page.condEquals, values)
}

// ─── Field Validation ────────────────────────────────────────────────────────

function validateField(field: DynamicField, value: unknown): string | null {
  // Skip validation for hidden fields
  if (field.isIncluded === false) return null

  const strVal = String(value ?? '')

  // Required check
  if (field.required && (!value || strVal.trim() === '')) {
    return field.errorMessage || `${field.label} is required`
  }

  // Skip further checks if empty and not required
  if (!value || strVal.trim() === '') return null

  // Min/max length for text fields
  if (field.minValue && strVal.length < Number(field.minValue)) {
    return `Minimum ${field.minValue} characters`
  }
  if (field.maxValue && ['TEXT', 'TEXTAREA', 'EMAIL', 'PHONE', 'URL'].includes(field.type)) {
    if (strVal.length > Number(field.maxValue)) {
      return `Maximum ${field.maxValue} characters`
    }
  }

  // Min/max for number fields
  if (field.type === 'NUMBER' && value !== '' && value != null) {
    const num = Number(value)
    if (field.minValue && num < Number(field.minValue)) {
      return `Minimum value is ${field.minValue}`
    }
    if (field.maxValue && num > Number(field.maxValue)) {
      return `Maximum value is ${field.maxValue}`
    }
  }

  // Regex pattern
  if (field.pattern) {
    try {
      const re = new RegExp(field.pattern)
      if (!re.test(strVal)) {
        return field.errorMessage || `Invalid format`
      }
    } catch {
      // Invalid regex — skip
    }
  }

  return null
}

// ─── Progress Bar ────────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 1 ? ((current) / total) * 100 : 100

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500">
          Step {current} of {total}
        </span>
        <span className="text-xs text-slate-400">{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Step Indicator (pill-style) ─────────────────────────────────────────────

function StepIndicator({
  pages,
  currentIndex,
  onStepClick,
}: {
  pages: { title: string; isOptional?: boolean }[]
  currentIndex: number
  onStepClick: (index: number) => void
}) {
  if (pages.length <= 1) return null

  return (
    <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
      {pages.map((page, i) => {
        const isActive = i === currentIndex
        const isCompleted = i < currentIndex

        return (
          <button
            key={i}
            type="button"
            onClick={() => i < currentIndex && onStepClick(i)}
            disabled={i > currentIndex}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
              isActive
                ? 'bg-slate-900 text-white'
                : isCompleted
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer'
                : 'bg-slate-50 text-slate-400'
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${
                isActive
                  ? 'bg-white/20 text-white'
                  : isCompleted
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-200 text-slate-400'
              }`}
            >
              {isCompleted ? <Check className="w-2.5 h-2.5" strokeWidth={3} /> : i + 1}
            </span>
            {page.title}
            {page.isOptional && (
              <span className="text-[10px] text-slate-400 font-normal">(optional)</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function DynamicFormRenderer({
  pages,
  looseFields = [],
  values,
  onChange,
  onSubmit,
  isSubmitting = false,
  submitLabel = 'Submit',
  externalErrors = {},
  disabledKeys = [],
  singlePageMode = false,
}: DynamicFormRendererProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touchedPages, setTouchedPages] = useState<Set<number>>(new Set([0]))

  // Build the effective page list (visible pages only)
  const visiblePages = useMemo(() => {
    // If no pages, create a virtual page from loose fields
    if (pages.length === 0 && looseFields.length > 0) {
      return [{
        id: '__virtual__',
        title: 'Form',
        sortOrder: 0,
        fields: looseFields,
      }] as DynamicPage[]
    }

    // Merge loose fields into the first page
    const merged = pages.map((p, i) => {
      if (i === 0 && looseFields.length > 0) {
        return { ...p, fields: [...looseFields, ...p.fields] }
      }
      return p
    })

    return merged.filter((p) => isPageVisible(p, values))
  }, [pages, looseFields, values])

  // Clamp current page index to valid range
  const safePageIndex = Math.min(currentPageIndex, visiblePages.length - 1)
  const currentPage = visiblePages[safePageIndex]
  const isLastPage = safePageIndex === visiblePages.length - 1
  const isFirstPage = safePageIndex === 0

  // Get visible fields for the current page
  const visibleFields = useMemo(() => {
    if (!currentPage) return []
    return currentPage.fields.filter((f) => isFieldVisible(f, values))
  }, [currentPage, values])

  const handleFieldChange = useCallback((key: string, value: unknown) => {
    onChange({ ...values, [key]: value })
    // Clear error when user starts typing
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [values, onChange])

  // Validate all visible fields on the current page
  const validateCurrentPage = useCallback((): boolean => {
    if (!currentPage) return true

    const pageErrors: Record<string, string> = {}
    for (const field of visibleFields) {
      const err = validateField(field, values[field.key])
      if (err) pageErrors[field.key] = err
    }

    setErrors((prev) => ({ ...prev, ...pageErrors }))
    return Object.keys(pageErrors).length === 0
  }, [currentPage, visibleFields, values])

  const goNext = useCallback(() => {
    // Optional pages can be skipped without validation
    if (!currentPage?.isOptional && !validateCurrentPage()) return
    if (currentPage?.isOptional && !validateCurrentPage()) {
      // On optional pages, only validate non-empty required fields
      // (user can skip but if they've filled things in, validate those)
    }

    const nextIndex = safePageIndex + 1
    setCurrentPageIndex(nextIndex)
    setTouchedPages((prev) => new Set([...prev, nextIndex]))
  }, [safePageIndex, validateCurrentPage, currentPage])

  const goBack = useCallback(() => {
    setCurrentPageIndex((prev) => Math.max(0, prev - 1))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!validateCurrentPage()) return
    await onSubmit(values)
  }, [validateCurrentPage, onSubmit, values])

  const goToPage = useCallback((index: number) => {
    if (index < safePageIndex) {
      setCurrentPageIndex(index)
    }
  }, [safePageIndex])

  if (!currentPage) return null

  // Merge internal + external errors
  const allErrors = { ...errors, ...externalErrors }

  // Single-page mode: render all fields flat, no navigation
  if (singlePageMode || visiblePages.length <= 1) {
    const allFields = visiblePages.flatMap((p) =>
      p.fields.filter((f) => isFieldVisible(f, values))
    )

    return (
      <div className="space-y-4">
        {allFields.map((field) => (
          <FieldRow
            key={field.id || field.key}
            field={field}
            value={values[field.key]}
            error={allErrors[field.key]}
            disabled={disabledKeys.includes(field.key)}
            onChange={(v) => handleFieldChange(field.key, v)}
          />
        ))}
      </div>
    )
  }

  // Multi-page mode
  return (
    <div>
      {/* Progress */}
      <ProgressBar current={safePageIndex + 1} total={visiblePages.length} />

      {/* Step indicator pills */}
      <StepIndicator
        pages={visiblePages.map((p) => ({ title: p.title, isOptional: p.isOptional }))}
        currentIndex={safePageIndex}
        onStepClick={goToPage}
      />

      {/* Page title */}
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-slate-900">{currentPage.title}</h3>
        {currentPage.description && (
          <p className="text-sm text-slate-500 mt-0.5">{currentPage.description}</p>
        )}
      </div>

      {/* Fields */}
      <div className="space-y-4 animate-in fade-in duration-200">
        {visibleFields.map((field) => (
          <FieldRow
            key={field.id || field.key}
            field={field}
            value={values[field.key]}
            error={allErrors[field.key]}
            disabled={disabledKeys.includes(field.key)}
            onChange={(v) => handleFieldChange(field.key, v)}
          />
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3 mt-8 pt-5 border-t border-slate-100">
        {!isFirstPage && (
          <button
            type="button"
            onClick={goBack}
            className="px-4 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 active:scale-[0.97] transition-all cursor-pointer flex items-center gap-1.5"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back
          </button>
        )}

        <div className="flex-1" />

        {currentPage.isOptional && !isLastPage && (
          <button
            type="button"
            onClick={goNext}
            className="px-4 py-2.5 text-sm text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
          >
            Skip
          </button>
        )}

        {isLastPage ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-60 active:scale-[0.97] transition-all cursor-pointer flex items-center gap-2"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            className="px-6 py-2.5 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer flex items-center gap-1.5"
          >
            Continue
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Field Row ───────────────────────────────────────────────────────────────

function FieldRow({
  field,
  value,
  error,
  disabled,
  onChange,
}: {
  field: DynamicField
  value: unknown
  error?: string
  disabled: boolean
  onChange: (v: unknown) => void
}) {
  // Layout fields (Header, Divider) don't have inputs
  if (field.type === 'HEADER') {
    return (
      <div className="pt-2">
        <h4 className="text-sm font-semibold text-slate-900">{field.label}</h4>
        {field.helpText && (
          <p className="text-xs text-slate-500 mt-0.5">{field.helpText}</p>
        )}
      </div>
    )
  }

  if (field.type === 'DIVIDER') {
    return <hr className="border-slate-200 my-2" />
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
        {field.protection === 'LOCKED' && (
          <span className="ml-1.5 text-[10px] text-slate-400" title="Required by the system">
            System field
          </span>
        )}
      </label>

      <FormFieldRenderer
        field={field}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />

      {field.helpText && !error && (
        <p className="text-xs text-slate-500">{field.helpText}</p>
      )}

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  )
}

// Re-export utilities for use in other components
export { evaluateCondition, isFieldVisible, isPageVisible, validateField }
