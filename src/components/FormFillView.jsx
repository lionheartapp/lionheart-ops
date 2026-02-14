import { useState, useCallback, useMemo, Fragment } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ChevronRight, ChevronLeft, Check } from 'lucide-react'

function evalCondition(conditional, values) {
  if (!conditional?.fieldId) return true
  const raw = values[conditional.fieldId]
  const val = typeof raw === 'string' ? raw.trim() : raw
  const op = conditional.operator || 'equals'
  const target = (conditional.value ?? '').trim().toLowerCase()
  const compare = (typeof val === 'string' ? val : String(val ?? '')).toLowerCase()

  switch (op) {
    case 'equals':
      return compare === target
    case 'not_equals':
      return compare !== target
    case 'contains':
      return compare.includes(target)
    case 'is_empty':
      return val === '' || val == null
    case 'is_not_empty':
      return val !== '' && val != null
    default:
      return true
  }
}

const EMAIL_REG = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_REG = /^[\d\s\-+()]{7,20}$/

function validateField(field, value) {
  if (field.required) {
    if (field.type === 'checklist') {
      if (!Array.isArray(value) || value.length === 0) return 'Select at least one option.'
    } else if (value == null || (typeof value === 'string' && !value.trim())) {
      return 'This field is required.'
    }
  }
  if (field.type === 'email' && value) {
    if (!EMAIL_REG.test(String(value).trim())) return 'Please enter a valid email.'
  }
  if (field.type === 'phone' && value) {
    if (!PHONE_REG.test(String(value).replace(/\s/g, ''))) return 'Please enter a valid phone number.'
  }
  const maxLen = field.validation?.maxLength
  if (maxLen && value && String(value).length > maxLen) {
    return `Maximum ${maxLen} characters.`
  }
  return null
}

export default function FormFillView({ form, onSubmit, onBack, isPreview = false, hideBackButton = false, previewViewport }) {
  const [values, setValues] = useState({})
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [currentStep, setCurrentStep] = useState(0)

  const layout = form.layout || 'default'
  const steps = form.steps || []
  const isMultiStep = steps.length > 0

  /* Preview viewport overrides: when simulating mobile/tablet, force layout to match (media queries use viewport, not container) */
  const isPreviewMobile = isPreview && previewViewport === 'mobile'
  const isPreviewTablet = isPreview && previewViewport === 'tablet'
  const isPreviewNarrow = isPreviewMobile || isPreviewTablet

  const allFields = (form.fields || []).filter((f) => evalCondition(f.conditional, values))
  const { fieldsForStep, stepCount } = useMemo(() => {
    if (!isMultiStep) return { fieldsForStep: allFields, stepCount: 1 }
    const step = steps[currentStep]
    if (!step?.fieldIds?.length) return { fieldsForStep: allFields, stepCount: steps.length }
    const ids = new Set(step.fieldIds)
    return {
      fieldsForStep: allFields.filter((f) => ids.has(f.id)),
      stepCount: steps.length,
    }
  }, [allFields, isMultiStep, steps, currentStep])

  const visibleFields = fieldsForStep.filter((f) => f.type !== 'section' && f.type !== 'table')

  const setValue = useCallback((fieldId, value) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }))
    if (touched[fieldId]) {
      setErrors((prev) => ({ ...prev, [fieldId]: null }))
    }
  }, [touched])

  const handleBlur = useCallback((field) => {
    setTouched((prev) => ({ ...prev, [field.id]: true }))
    const err = validateField(field, values[field.id])
    setErrors((prev) => ({ ...prev, [field.id]: err }))
  }, [values])

  const handleSubmit = (e) => {
    e.preventDefault()
    const newTouched = {}
    const newErrors = {}
    visibleFields.forEach((f) => {
      newTouched[f.id] = true
      const err = validateField(f, values[f.id])
          if (err) newErrors[f.id] = err
    })
    setTouched(newTouched)
    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    const data = {}
    ;(form.fields || []).forEach((f) => {
      const v = values[f.id]
      if (f.type === 'checkbox') data[f.id] = !!v
      else if (f.type === 'checklist') data[f.id] = v || []
      else if (v != null && v !== '') data[f.id] = v
    })
    onSubmit(data)
  }

  const handleStepNext = () => {
    if (currentStep < stepCount - 1) setCurrentStep((s) => s + 1)
  }
  const handleStepPrev = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1)
  }

  const formContent = (
    <div
      className={`min-w-0 ${
        layout === 'split'
          ? 'py-4 sm:py-6 lg:py-8'
          : `py-4 sm:py-6 lg:py-8 ${layout === 'header-cover' && form.headerImage ? 'glass-card rounded-b-xl px-0' : 'glass-card px-6'}`
      }`}
    >
      {isMultiStep && (
        <div className="form-fill-stepper mb-4 sm:mb-6 lg:mb-8 min-w-0 overflow-hidden">
          <div className="flex items-start w-full min-w-0">
            {steps.map((s, i) => {
              const isActive = i === currentStep
              const isCompleted = i < currentStep
              return (
                <Fragment key={s.id}>
                  <div className="flex flex-col items-center shrink-0">
                    <div
                      className={`form-fill-stepper-dot ${
                        isActive
                          ? 'form-fill-stepper-dot-active'
                          : isCompleted
                            ? 'form-fill-stepper-dot-completed'
                            : 'form-fill-stepper-dot-upcoming'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                      ) : (
                        <span className="text-xs font-semibold">{i + 1}</span>
                      )}
                    </div>
                    <span
                      className={`form-fill-stepper-label mt-1.5 sm:mt-2 text-[10px] sm:text-xs lg:text-sm font-medium truncate max-w-[65px] sm:max-w-[90px] lg:max-w-[130px] text-center block ${
                        isActive
                          ? 'text-blue-600 dark:text-blue-400'
                          : isCompleted
                            ? 'text-zinc-500 dark:text-zinc-400'
                            : 'text-zinc-400 dark:text-zinc-500'
                      }`}
                    >
                      {s.title || `Step ${i + 1}`}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className={`form-fill-stepper-connector flex-1 min-w-0 h-0.5 mx-1 sm:mx-3 rounded-full transition-colors mt-4 ${
                        isCompleted ? 'form-fill-stepper-connector-done bg-blue-400' : 'bg-zinc-100 dark:bg-zinc-600'
                      }`}
                    />
                  )}
                </Fragment>
              )
            })}
          </div>
        </div>
      )}
      {form.showTitle !== false && (
        <div className={`min-w-0 ${isMultiStep ? '' : 'mb-2'}`}>
          <h2 className="form-fill-title">
            {form.title || 'Untitled form'}
          </h2>
          {form.description && (
            <p className="form-fill-desc mt-1.5 sm:mt-2">{form.description}</p>
          )}
        </div>
      )}

        <form onSubmit={handleSubmit} className="form-fill mt-6">
          {/* Hidden inputs (outside grid) */}
          {fieldsForStep.filter((f) => f.type === 'hidden').map((field) => (
            <input
              key={field.id}
              type="hidden"
              name={field.id}
              value={values[field.id] ?? ''}
              readOnly
            />
          ))}
          <div className={`grid gap-x-3 gap-y-4 sm:gap-x-4 sm:gap-y-5 min-w-0 ${
            isPreviewMobile || isPreviewTablet ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'
          }`}>
          {fieldsForStep.filter((f) => f.type !== 'hidden').map((field) => {
            const value = values[field.id]
            const error = errors[field.id]
            const id = `fill-${field.id}`
            const colSpan = ['section', 'table'].includes(field.type) ? 2 : (field.colSpan ?? 1)

            if (field.type === 'section') {
              const sectionStyle = {}
              if (field.sectionBackgroundImage) {
                sectionStyle.backgroundImage = `url(${field.sectionBackgroundImage})`
                sectionStyle.backgroundSize = 'cover'
                sectionStyle.backgroundPosition = 'center'
              }
              if (field.sectionBackgroundColor) {
                sectionStyle.backgroundColor = field.sectionBackgroundColor
              }
              return (
                <div
                  key={field.id}
                  className={`min-w-0 pt-6 pb-2 px-4 -mx-4 border-t mt-6 first:mt-0 first:pt-0 first:border-t-0 ${colSpan === 2 ? 'col-span-2' : 'col-span-1'} ${
                    layout === 'split'
                      ? 'border-zinc-100/60 dark:border-zinc-800/60'
                      : 'border-zinc-200 dark:border-zinc-600'
                  }`}
                  style={Object.keys(sectionStyle).length ? sectionStyle : undefined}
                >
                  <h3 className="form-fill-section-title">
                    {field.label || 'Section'}
                  </h3>
                  {field.description && (
                    <p className="form-fill-section-desc text-sm mt-0.5">{field.description}</p>
                  )}
                </div>
              )
            }
            if (field.type === 'table') {
              return (
                <div key={field.id} className={`min-w-0 text-sm text-zinc-500 py-2 ${colSpan === 2 ? 'col-span-2' : 'col-span-1'}`}>
                  [Table field – coming soon]
                </div>
              )
            }

            return (
              <div key={field.id} className={`min-w-0 space-y-1 ${colSpan === 2 ? 'col-span-2' : 'col-span-1'}`}>
                {field.type !== 'checkbox' && (
                  <label
                    htmlFor={id}
                    className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    {field.label}
                    {field.required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                )}
                {field.type === 'text' && (
                  <input
                    id={id}
                    type="text"
                    value={value ?? ''}
                    onChange={(e) => setValue(field.id, e.target.value)}
                    onBlur={() => handleBlur(field)}
                    placeholder={field.placeholder}
                    maxLength={field.validation?.maxLength ?? undefined}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${id}-error` : undefined}
                    className={`w-full px-3 py-2.5 rounded-lg border bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm transition-colors ${
                      error ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-600'
                    }`}
                  />
                )}
                {field.type === 'textarea' && (
                  <textarea
                    id={id}
                    value={value ?? ''}
                    onChange={(e) => setValue(field.id, e.target.value)}
                    onBlur={() => handleBlur(field)}
                    placeholder={field.placeholder}
                    maxLength={field.validation?.maxLength ?? undefined}
                    rows={4}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${id}-error` : undefined}
                    className={`w-full px-3 py-2.5 rounded-lg border bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm resize-y transition-colors ${
                      error ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-600'
                    }`}
                  />
                )}
                {field.type === 'email' && (
                  <input
                    id={id}
                    type="email"
                    value={value ?? ''}
                    onChange={(e) => setValue(field.id, e.target.value)}
                    onBlur={() => handleBlur(field)}
                    placeholder={field.placeholder}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${id}-error` : undefined}
                    className={`w-full px-3 py-2.5 rounded-lg border bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm transition-colors ${
                      error ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-600'
                    }`}
                  />
                )}
                {field.type === 'phone' && (
                  <input
                    id={id}
                    type="tel"
                    value={value ?? ''}
                    onChange={(e) => setValue(field.id, e.target.value)}
                    onBlur={() => handleBlur(field)}
                    placeholder={field.placeholder}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${id}-error` : undefined}
                    className={`w-full px-3 py-2.5 rounded-lg border bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm transition-colors ${
                      error ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-600'
                    }`}
                  />
                )}
                {field.type === 'number' && (
                  <input
                    id={id}
                    type="number"
                    value={value ?? ''}
                    onChange={(e) => setValue(field.id, e.target.value === '' ? '' : e.target.value)}
                    onBlur={() => handleBlur(field)}
                    placeholder={field.placeholder}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${id}-error` : undefined}
                    className={`w-full px-3 py-2.5 rounded-lg border bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm transition-colors ${
                      error ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-600'
                    }`}
                  />
                )}
                {field.type === 'date' && (
                  <input
                    id={id}
                    type="date"
                    value={value ?? ''}
                    onChange={(e) => setValue(field.id, e.target.value)}
                    onBlur={() => handleBlur(field)}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${id}-error` : undefined}
                    className={`w-full px-3 py-2.5 rounded-lg border bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm transition-colors ${
                      error ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-600'
                    }`}
                  />
                )}
                {field.type === 'datetime' && (
                  <input
                    id={id}
                    type="datetime-local"
                    value={value ?? ''}
                    onChange={(e) => setValue(field.id, e.target.value)}
                    onBlur={() => handleBlur(field)}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${id}-error` : undefined}
                    className={`w-full px-3 py-2.5 rounded-lg border bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm transition-colors ${
                      error ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-600'
                    }`}
                  />
                )}
                {field.type === 'yesno' && (
                  <div className="space-y-2" role="group" aria-labelledby={id}>
                    {(field.options || ['Yes', 'No']).map((opt, idx) => (
                      <label key={idx} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={field.id}
                          value={opt}
                          checked={(value ?? '') === opt}
                          onChange={() => setValue(field.id, opt)}
                          onBlur={() => handleBlur(field)}
                          className="rounded-full border-zinc-300 dark:border-zinc-600 text-blue-500"
                        />
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">{opt}</span>
                      </label>
                    ))}
                  </div>
                )}
                {field.type === 'checklist' && (
                  <div className="space-y-2" role="group" aria-labelledby={id}>
                    {(field.options || []).map((opt, idx) => {
                      const checked = (value || []).includes(opt)
                      return (
                        <label key={idx} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const next = checked
                                ? (value || []).filter((x) => x !== opt)
                                : [...(value || []), opt]
                              setValue(field.id, next)
                            }}
                            onBlur={() => handleBlur(field)}
                            className="rounded border-zinc-300 dark:border-zinc-600 text-blue-500"
                          />
                          <span className="text-sm text-zinc-700 dark:text-zinc-300">{opt}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
                {field.type === 'profiles' && (
                  <input
                    id={id}
                    type="text"
                    value={value ?? ''}
                    onChange={(e) => setValue(field.id, e.target.value)}
                    onBlur={() => handleBlur(field)}
                    placeholder="Select or type user name"
                    aria-invalid={!!error}
                    aria-describedby={error ? `${id}-error` : undefined}
                    className={`w-full px-3 py-2.5 rounded-lg border bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm transition-colors ${
                      error ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-600'
                    }`}
                  />
                )}
                {field.type === 'attachment' && (
                  <div className="form-fill-file-wrapper">
                    <label htmlFor={id} className="form-fill-file-btn">
                      Choose files
                    </label>
                    <span className="form-fill-file-text truncate">
                      {value ? value : 'No file chosen'}
                    </span>
                    <input
                      id={id}
                      type="file"
                      multiple
                      onChange={(e) => {
                        const files = e.target.files
                        if (files?.length) {
                          const names = [...files].map((f) => f.name)
                          setValue(field.id, names.join(', '))
                        }
                      }}
                      onBlur={() => handleBlur(field)}
                      className="sr-only"
                      accept="*/*"
                      aria-describedby={error ? `${id}-error` : undefined}
                      aria-invalid={!!error}
                    />
                  </div>
                )}
                {field.type === 'image' && (
                  <div className="form-fill-file-wrapper">
                    <label htmlFor={id} className="form-fill-file-btn">
                      Choose image
                    </label>
                    <span className="form-fill-file-text">
                      {value ? value : 'No file chosen'}
                    </span>
                    <input
                      id={id}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) setValue(field.id, f.name)
                      }}
                      onBlur={() => handleBlur(field)}
                      className="sr-only"
                      aria-describedby={error ? `${id}-error` : undefined}
                      aria-invalid={!!error}
                    />
                  </div>
                )}
                {field.type === 'slider' && (
                  <div className="space-y-1">
                    <input
                      id={id}
                      type="range"
                      min={field.validation?.min ?? 0}
                      max={field.validation?.max ?? 100}
                      value={value ?? field.validation?.min ?? 0}
                      onChange={(e) => setValue(field.id, parseInt(e.target.value, 10))}
                      onBlur={() => handleBlur(field)}
                      className="w-full h-2 rounded-lg appearance-none bg-zinc-200 dark:bg-zinc-600"
                    />
                    <span className="text-sm text-zinc-500">{value ?? 0}</span>
                  </div>
                )}
                {field.type === 'dropdown' && (
                  <select
                    id={id}
                    value={value ?? ''}
                    onChange={(e) => setValue(field.id, e.target.value)}
                    onBlur={() => handleBlur(field)}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${id}-error` : undefined}
                    className={`select-arrow-padded w-full pl-3 py-2.5 rounded-lg border bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm transition-colors ${
                      error ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-600'
                    }`}
                  >
                    <option value="">Select...</option>
                    {(field.options || []).map((opt, idx) => (
                      <option key={idx} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}
                {field.type === 'radio' && (
                  <div className="space-y-2" role="group" aria-labelledby={id}>
                    {(field.options || []).map((opt, idx) => (
                      <label key={idx} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={field.id}
                          value={opt}
                          checked={(value ?? '') === opt}
                          onChange={() => setValue(field.id, opt)}
                          onBlur={() => handleBlur(field)}
                          className="rounded-full border-zinc-300 dark:border-zinc-600 text-blue-500"
                        />
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">{opt}</span>
                      </label>
                    ))}
                  </div>
                )}
                {field.type === 'checkbox' && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      id={id}
                      type="checkbox"
                      checked={!!value}
                      onChange={(e) => setValue(field.id, e.target.checked)}
                      onBlur={() => handleBlur(field)}
                      className="rounded border-zinc-300 dark:border-zinc-600 text-blue-500"
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-0.5">*</span>}
                    </span>
                  </label>
                )}
                {field.type === 'signature' && (
                  <div className="border border-zinc-200 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800/50 p-2">
                    <canvas
                      id={id}
                      width={320}
                      height={120}
                      className="w-full max-w-md border border-dashed border-zinc-300 dark:border-zinc-500 rounded touch-none cursor-crosshair"
                      style={{ touchAction: 'none' }}
                      onMouseDown={(e) => {
                        const canvas = e.target
                        const ctx = canvas.getContext('2d')
                        if (!ctx) return
                        ctx.strokeStyle = '#111'
                        ctx.lineWidth = 2
                        ctx.lineCap = 'round'
                        const rect = canvas.getBoundingClientRect()
                        const scaleX = canvas.width / rect.width
                        const scaleY = canvas.height / rect.height
                        ctx.beginPath()
                        ctx.moveTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY)
                        const move = (ev) => {
                          ctx.lineTo(
                            (ev.clientX - rect.left) * scaleX,
                            (ev.clientY - rect.top) * scaleY
                          )
                          ctx.stroke()
                        }
                        const up = () => {
                          window.removeEventListener('mousemove', move)
                          window.removeEventListener('mouseup', up)
                          const dataUrl = canvas.toDataURL('image/png')
                          setValue(field.id, dataUrl)
                        }
                        window.addEventListener('mousemove', move)
                        window.addEventListener('mouseup', up)
                      }}
                      onTouchStart={(e) => {
                        e.preventDefault()
                        const canvas = e.target
                        const ctx = canvas.getContext('2d')
                        if (!ctx || !e.touches[0]) return
                        ctx.strokeStyle = '#111'
                        ctx.lineWidth = 2
                        ctx.lineCap = 'round'
                        const rect = canvas.getBoundingClientRect()
                        const scaleX = canvas.width / rect.width
                        const scaleY = canvas.height / rect.height
                        const t = e.touches[0]
                        ctx.beginPath()
                        ctx.moveTo((t.clientX - rect.left) * scaleX, (t.clientY - rect.top) * scaleY)
                        const move = (ev) => {
                          if (!ev.touches[0]) return
                          const t = ev.touches[0]
                          ctx.lineTo(
                            (t.clientX - rect.left) * scaleX,
                            (t.clientY - rect.top) * scaleY
                          )
                          ctx.stroke()
                        }
                        const end = () => {
                          window.removeEventListener('touchmove', move)
                          window.removeEventListener('touchend', end)
                          setValue(field.id, canvas.toDataURL('image/png'))
                        }
                        window.addEventListener('touchmove', move, { passive: false })
                        window.addEventListener('touchend', end)
                      }}
                    />
                    <p className="text-xs text-zinc-500 mt-1">Draw your signature above.</p>
                  </div>
                )}
                {error && (
                  <p id={`${id}-error`} className="text-sm text-red-500" role="alert">
                    {error}
                  </p>
                )}
              </div>
            )
          })}
          </div>

          <div className="pt-4 sm:pt-5 flex flex-wrap items-center gap-2 sm:gap-3">
            {isMultiStep && currentStep > 0 && (
              <button
                type="button"
                onClick={handleStepPrev}
                className="form-fill-prev-btn inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
            )}
            {isMultiStep && currentStep < stepCount - 1 ? (
              <button
                type="button"
                onClick={handleStepNext}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                className={`${isPreview && previewViewport === 'mobile' ? 'w-full' : 'w-full sm:w-auto'} px-6 py-2.5 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2`}
              >
                Submit
              </button>
            )}
          </div>
        </form>
      </div>
  )

  const hasHeaderCover = layout === 'header-cover' && form.headerImage
  const isSplit = layout === 'split' && form.sideImage
  const contentWrapperClass = isPreview
    ? `form-preview-light overflow-x-hidden ${hasHeaderCover ? 'pt-0 pb-8' : 'py-8'} ${isSplit ? 'h-full min-h-0' : 'min-h-0'}`
    : isSplit ? 'flex-1 min-h-0 overflow-hidden' : ''

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`w-full max-w-full min-w-0 flex flex-col items-center overflow-x-hidden form-fill-layout-${layout} ${contentWrapperClass} ${isSplit ? 'flex-1 min-h-0' : ''}`}
    >
      {/* Full-width header image – edge-to-edge in live form; constrained in preview viewport */}
      {hasHeaderCover && (
        <div
          className={`h-60 sm:h-80 overflow-hidden ${
            isPreview ? 'w-full' : 'w-screen max-w-none relative left-1/2 -translate-x-1/2'
          }`}
        >
          <img
            src={form.headerImage}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Split layout: form left, image right – stacked on mobile/tablet preview, side-by-side on desktop */}
      {isSplit ? (
        <div className={`flex w-full flex-1 min-h-0 overflow-hidden h-full min-w-0 ${
          isPreviewNarrow ? 'flex-col' : 'flex-col lg:flex-row'
        }`}>
          {/* Form area */}
          <div className={`flex flex-col shrink-0 overflow-hidden min-h-0 px-6 sm:px-6 lg:px-8 ${
            isPreviewNarrow ? '' : 'lg:flex-1 lg:min-w-0'
          }`}>
            <div className={`split-form-panel w-full flex flex-col bg-white py-4 sm:py-6 min-h-0 min-w-0 ${
              isPreviewNarrow
                ? 'px-0 overflow-visible'
                : 'max-w-2xl lg:mx-auto lg:py-12 lg:px-8 overflow-y-auto overscroll-contain'
            }`}>
              {!hideBackButton && (
                <button
                  type="button"
                  onClick={onBack}
                  className={
                    isPreview
                      ? 'mb-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-zinc-300 bg-white text-zinc-700 font-medium hover:bg-zinc-50 transition-colors shadow-sm w-fit'
                      : 'inline-flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 mb-6 w-fit'
                  }
                >
                  {isPreview ? 'Back to Form Builder' : <><ArrowLeft className="w-4 h-4" />Back</>}
                </button>
              )}
              {formContent}
            </div>
          </div>
          {/* Image: stacked full-width on mobile/tablet, side-by-side on desktop */}
          <div className={`shrink-0 flex items-center justify-center p-4 sm:p-6 overflow-hidden min-w-0 ${
            isPreviewNarrow ? '' : 'min-h-[220px] sm:min-h-[280px] lg:min-h-0 lg:flex-1 lg:p-8'
          }`}>
            <div className={`aspect-[3/4] overflow-hidden rounded-2xl ${
              isPreviewNarrow ? 'w-full max-w-full' : 'w-full max-w-sm lg:max-w-none lg:w-full lg:h-full lg:aspect-auto'
            }`}>
              <img
                src={form.sideImage}
                alt=""
                className="w-full h-full object-cover object-center"
              />
            </div>
          </div>
        </div>
      ) : (
        <div
          className={`mx-auto w-full max-w-4xl ${hasHeaderCover ? '-mt-20 sm:-mt-24 px-6 sm:px-6 lg:px-8' : 'pt-6 px-6'}`}
        >
          {!hideBackButton && (
            <button
              type="button"
              onClick={onBack}
              className={
                isPreview
                  ? 'mb-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-zinc-300 bg-white text-zinc-700 font-medium hover:bg-zinc-50 transition-colors shadow-sm'
                  : 'inline-flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 mb-6'
              }
            >
              {isPreview ? (
                'Back to Form Builder'
              ) : (
                <>
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </>
              )}
            </button>
          )}
          {formContent}
        </div>
      )}
    </motion.div>
  )
}
