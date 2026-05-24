'use client'

import { use, useState, useEffect } from 'react'
import { CheckCircle2, Loader2, AlertTriangle, ArrowLeft, ArrowRight } from 'lucide-react'
import TicketSelector from '@/components/forms/checkout/TicketSelector'
import OrderSummary from '@/components/forms/checkout/OrderSummary'
import { Tag } from 'lucide-react'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

// ─── Types ──────────────────────────────────────────────────────────────────

interface FormPageData {
  id: string
  title: string
  description: string | null
  sortOrder: number
  isOptional: boolean
  fields: FormFieldData[]
}

interface FormFieldData {
  id: string
  key: string
  label: string
  type: string
  required: boolean
  placeholder: string | null
  helpText: string | null
  options: string[]
  isIncluded: boolean
  sensitivityLevel: string
}

interface PublicTicketType {
  id: string
  name: string
  description: string | null
  price: number
  maxPerOrder: number | null
  totalInventory: number | null
  available: number | null
}

interface PublicFormData {
  id: string
  description: string | null
  coverColor: string | null
  requireEmail: boolean
  confirmMessage: string | null
  publicStyle: string
  publicCtaColor: string | null
  publicBgColor: string | null
  publicImageUrl: string | null
  publicImageSide: string
  logoUrl: string | null
  pages: FormPageData[]
  ticketTypes?: PublicTicketType[]
  hasDiscountCodes?: boolean
  maxCapacity?: number | null
  totalSold?: number
}

// ─── Field Renderer ─────────────────────────────────────────────────────────

function PublicField({
  field,
  value,
  onChange,
  error,
}: {
  field: FormFieldData
  value: string
  onChange: (v: string) => void
  error?: string
}) {
  if (field.type === 'HEADER') {
    return <h3 className="text-base font-semibold text-slate-800 pt-2">{field.label}</h3>
  }
  if (field.type === 'DIVIDER') {
    return <hr className="border-slate-200 my-1" />
  }
  if (field.type === 'TICKET_SELECTOR') {
    return null // rendered separately by FormContent
  }

  return (
    <div>
      <label className="text-sm font-medium text-slate-700 block mb-1.5">
        {field.label}
        {field.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {field.helpText && (
        <p className="text-xs text-slate-400 mb-1.5">{field.helpText}</p>
      )}

      {(field.type === 'TEXT' || field.type === 'EMAIL' || field.type === 'PHONE' || field.type === 'URL' || field.type === 'NUMBER') && (
        <Input
          type={field.type === 'EMAIL' ? 'email' : field.type === 'NUMBER' ? 'number' : field.type === 'PHONE' ? 'tel' : field.type === 'URL' ? 'url' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || ''}
        />
      )}
      {field.type === 'TEXTAREA' && (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || ''}
          rows={3}
        />
      )}
      {(field.type === 'DROPDOWN' || field.type === 'RADIO') && (
        <Select
          value={value}
          onChange={onChange}
          options={[
            { value: '', label: 'Select...' },
            ...field.options.map((opt) => ({ value: opt, label: opt })),
          ]}
        />
      )}
      {field.type === 'MULTI_SELECT' && (
        <div className="grid grid-cols-2 gap-2">
          {field.options.map((opt) => {
            const selected = (value || '').split(',').filter(Boolean)
            const isChecked = selected.includes(opt)
            return (
              <Checkbox
                key={opt}
                checked={isChecked}
                onChange={() => {
                  const next = isChecked ? selected.filter((s) => s !== opt) : [...selected, opt]
                  onChange(next.join(','))
                }}
                label={opt}
              />
            )
          })}
        </div>
      )}
      {field.type === 'CHECKBOX' && (
        <Checkbox
          checked={value === 'true'}
          onChange={(e) => onChange(e.target.checked ? 'true' : '')}
          label="Yes"
        />
      )}
      {(field.type === 'DATE' || field.type === 'TIME') && (
        <Input
          type={field.type === 'DATE' ? 'date' : 'time'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.type === 'RATING' && (
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(String(n))}
              className={`w-10 h-10 rounded-lg border text-lg transition-colors cursor-pointer ${
                Number(value) >= n
                  ? 'bg-amber-400 border-amber-400 text-white'
                  : 'border-slate-200 text-slate-300 hover:border-amber-300'
              }`}
            >
              ★
            </button>
          ))}
        </div>
      )}
      {field.type === 'SCALE' && (
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(String(n))}
              className={`w-8 h-8 rounded-full border text-xs font-medium transition-colors cursor-pointer ${
                Number(value) === n
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'border-slate-200 text-slate-500 hover:border-slate-400'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

// ─── Form Content (shared between layouts) ──────────────────────────────────

function FormContent({
  form,
  visiblePages,
  currentPage,
  setCurrentPage,
  values,
  setValues,
  email,
  setEmail,
  validationErrors,
  setValidationErrors,
  submitting,
  setSubmitting,
  setSubmitted,
  // Ticket props (optional — only used when form has a TICKET_SELECTOR field)
  ticketTypes,
  ticketQuantities,
  onTicketQuantityChange,
  hasDiscountCodes,
  promoCode,
  setPromoCode,
  promoApplied,
  onApplyPromo,
}: {
  form: PublicFormData
  visiblePages: FormPageData[]
  currentPage: number
  setCurrentPage: (p: number | ((p: number) => number)) => void
  values: Record<string, string>
  setValues: (v: Record<string, string> | ((v: Record<string, string>) => Record<string, string>)) => void
  email: string
  setEmail: (e: string) => void
  validationErrors: Record<string, string>
  setValidationErrors: (e: Record<string, string>) => void
  submitting: boolean
  setSubmitting: (s: boolean) => void
  setSubmitted: (s: boolean) => void
  // Ticket props
  ticketTypes?: PublicTicketType[]
  ticketQuantities?: Record<string, number>
  onTicketQuantityChange?: (id: string, qty: number) => void
  hasDiscountCodes?: boolean
  promoCode?: string
  setPromoCode?: (v: string) => void
  promoApplied?: string | null
  onApplyPromo?: () => void
}) {
  const page = visiblePages[currentPage]
  const isLastPage = currentPage === visiblePages.length - 1
  const totalPages = visiblePages.length
  const ctaColor = form.publicCtaColor || '#0f172a'

  function validatePage(): boolean {
    const errors: Record<string, string> = {}
    if (!page) return true
    for (const field of page.fields) {
      if (field.required && !values[field.key]?.trim()) {
        errors[field.key] = `${field.label} is required`
      }
    }
    if (isLastPage && form.requireEmail && !email.trim()) {
      errors['__email'] = 'Email is required'
    }
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Check if this form has tickets selected
  const hasTicketsSelected = ticketQuantities && Object.values(ticketQuantities).some((q) => q > 0)
  const ticketTotal = (ticketTypes ?? []).reduce((sum, tt) => sum + (tt.price * ((ticketQuantities ?? {})[tt.id] ?? 0)), 0)

  async function handleNext() {
    if (!validatePage()) return
    if (isLastPage) {
      setSubmitting(true)
      try {
        if (hasTicketsSelected) {
          // Ticket checkout flow — create order + payment
          const lineItems = Object.entries(ticketQuantities!)
            .filter(([, qty]) => qty > 0)
            .map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity }))

          const res = await fetch(`/api/f/${form.id}/checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lineItems,
              buyerName: values['full_name'] || values['name'] || values['student_name'] || email || 'Guest',
              buyerEmail: email || values['email'] || '',
              discountCode: promoApplied || undefined,
              formData: values,
            }),
          })
          const json = await res.json()
          if (json.ok) {
            if (json.data.clientSecret) {
              // Need payment — store state and show payment step
              // For now, redirect to a payment page (Stripe hosted)
              // TODO: inline Stripe Elements payment step
              setValidationErrors({ __form: 'Payment integration coming soon. Order created: ' + json.data.orderId })
            } else {
              // Free order — done
              setSubmitted(true)
            }
          } else {
            setValidationErrors({ __form: json.error?.message || 'Checkout failed' })
          }
        } else {
          // Regular form submission (no tickets)
          const res = await fetch(`/api/f/${form.id}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: values, submitterEmail: email || null }),
          })
          const json = await res.json()
          if (json.ok) setSubmitted(true)
          else setValidationErrors({ __form: json.error?.message || 'Submission failed' })
        }
      } catch {
        setValidationErrors({ __form: 'Something went wrong. Please try again.' })
      } finally {
        setSubmitting(false)
      }
    } else {
      setCurrentPage((p: number) => p + 1)
      setValidationErrors({})
    }
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      {totalPages > 1 && (
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>Step {currentPage + 1} of {totalPages}</span>
          </div>
          <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${((currentPage + 1) / totalPages) * 100}%`, backgroundColor: ctaColor }}
            />
          </div>
        </div>
      )}

      {/* Page title */}
      {totalPages > 1 && page && (
        <h2 className="text-sm font-semibold text-slate-700">{page.title}</h2>
      )}

      {/* Fields */}
      {page?.fields.map((field) => {
        // Render ticket selector inline where the TICKET_SELECTOR field is placed
        if (field.type === 'TICKET_SELECTOR' && ticketTypes && ticketQuantities && onTicketQuantityChange) {
          const totalQty = Object.values(ticketQuantities).reduce((a: number, b: number) => a + b, 0)
          return (
            <div key={field.id} className="space-y-4">
              <TicketSelector
                ticketTypes={ticketTypes}
                quantities={ticketQuantities}
                onChange={onTicketQuantityChange}
              />
              {hasDiscountCodes && setPromoCode && onApplyPromo && (
                <div>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={promoCode ?? ''}
                      onChange={(e) => setPromoCode(e.target.value)}
                      placeholder="Promo code"
                      className="h-10 flex-1"
                    />
                    <button
                      type="button"
                      onClick={onApplyPromo}
                      disabled={!(promoCode ?? '').trim()}
                      className="px-4 h-10 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Apply
                    </button>
                  </div>
                  {promoApplied && (
                    <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                      <Tag className="w-3 h-3" /> {promoApplied} will be applied at checkout
                    </p>
                  )}
                </div>
              )}
              {totalQty > 0 && (
                <OrderSummary
                  ticketTypes={ticketTypes}
                  quantities={ticketQuantities}
                  discountLabel={promoApplied ?? null}
                  discountAmount={0}
                />
              )}
            </div>
          )
        }
        return (
          <PublicField
            key={field.id}
            field={field}
            value={values[field.key] ?? ''}
            onChange={(v) => setValues((prev: Record<string, string>) => ({ ...prev, [field.key]: v }))}
            error={validationErrors[field.key]}
          />
        )
      })}

      {/* Email on last page */}
      {isLastPage && form.requireEmail && (
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1.5">
            Your Email <span className="text-red-400">*</span>
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          {validationErrors['__email'] && (
            <p className="text-xs text-red-500 mt-1">{validationErrors['__email']}</p>
          )}
        </div>
      )}

      {validationErrors['__form'] && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
          {validationErrors['__form']}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        {currentPage > 0 ? (
          <button
            type="button"
            onClick={() => { setCurrentPage((p: number) => p - 1); setValidationErrors({}) }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
        ) : (
          <div />
        )}
        <button
          type="button"
          onClick={handleNext}
          disabled={submitting}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          style={{ backgroundColor: ctaColor }}
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isLastPage ? (
            hasTicketsSelected && ticketTotal > 0
              ? `Pay $${(ticketTotal / 100).toFixed(2)}`
              : 'Submit'
          ) : (
            <>Continue <ArrowRight className="w-3.5 h-3.5" /></>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Layout Components ──────────────────────────────────────────────────────

function SplitLayout({ form, children, imageUrl, imageSide }: { form: PublicFormData; children: React.ReactNode; imageUrl: string; imageSide: string }) {
  const bgColor = form.publicBgColor || '#f8fafc'
  const isLeft = imageSide === 'LEFT'

  return (
    <div className="min-h-screen" style={{ backgroundColor: bgColor }}>
      {/* Mobile: stacked hero image on top */}
      <div className="lg:hidden">
        <div className="w-full h-[200px] relative overflow-hidden">
          <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        </div>
        <div className="px-5 py-8">
          {form.logoUrl && <img src={form.logoUrl} alt="" className="h-12 max-w-[180px] object-contain mb-8 mx-auto" />}
          <h1 className="text-2xl font-bold text-slate-900 mb-6">{form.description || 'Form'}</h1>
          {children}
          <p className="text-center text-[10px] text-slate-300 mt-8">Powered by Lionheart</p>
        </div>
      </div>

      {/* Desktop: side by side — image stays fixed, form scrolls */}
      <div className="hidden lg:flex min-h-screen bg-white">
        {isLeft && (
          <div className="w-1/2 sticky top-0 h-screen p-5" style={{ backgroundColor: bgColor }}>
            <img src={imageUrl} alt="" className="w-full h-full object-cover rounded-2xl" />
          </div>
        )}
        <div className="flex-1 flex items-start justify-center py-10 px-16 bg-white">
          <div className="w-full max-w-md">
            {form.logoUrl && <img src={form.logoUrl} alt="" className="h-12 max-w-[180px] object-contain mb-8 mx-auto" />}
            <h1 className="text-2xl font-bold text-slate-900 mb-8">{form.description || 'Form'}</h1>
            {children}
            <p className="text-center text-[10px] text-slate-300 mt-8">Powered by Lionheart</p>
          </div>
        </div>
        {!isLeft && (
          <div className="w-1/2 sticky top-0 h-screen p-5" style={{ backgroundColor: bgColor }}>
            <img src={imageUrl} alt="" className="w-full h-full object-cover rounded-2xl" />
          </div>
        )}
      </div>
    </div>
  )
}

function HeroLayout({ form, children, imageUrl }: { form: PublicFormData; children: React.ReactNode; imageUrl: string }) {
  const bgColor = form.publicBgColor || '#f8fafc'

  return (
    <div className="min-h-screen" style={{ backgroundColor: bgColor }}>
      {/* Hero image */}
      <div className="w-full h-[35vh] relative overflow-hidden">
        <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      </div>
      {/* Form card overlapping the image */}
      <div className="relative -mt-12 z-10 px-4 pb-10">
        <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
          {form.logoUrl && <img src={form.logoUrl} alt="" className="h-12 max-w-[180px] object-contain mb-8 mx-auto" />}
          <h1 className="text-2xl font-bold text-slate-900 mb-6">{form.description || 'Form'}</h1>
          {children}
        </div>
        <p className="text-center text-[10px] text-slate-300 mt-6">Powered by Lionheart</p>
      </div>
    </div>
  )
}

function MinimalLayout({ form, children }: { form: PublicFormData; children: React.ReactNode }) {
  const bgColor = form.publicBgColor || '#f8fafc'

  return (
    <div className="min-h-screen py-10 px-4" style={{ backgroundColor: bgColor }}>
      <div className="max-w-xl mx-auto">
        {form.coverColor && (
          <div className="h-2 rounded-t-2xl" style={{ backgroundColor: form.coverColor }} />
        )}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          {form.logoUrl && <img src={form.logoUrl} alt="" className="h-12 max-w-[180px] object-contain mb-8 mx-auto" />}
          <h1 className="text-2xl font-bold text-slate-900 mb-6">{form.description || 'Form'}</h1>
          {children}
        </div>
        <p className="text-center text-[10px] text-slate-300 mt-6">Powered by Lionheart</p>
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function PublicFormPage({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = use(params)
  const [form, setForm] = useState<PublicFormData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [values, setValues] = useState<Record<string, string>>({})
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  // Ticket state
  const [ticketQuantities, setTicketQuantities] = useState<Record<string, number>>({})
  const [promoCode, setPromoCode] = useState('')
  const [promoApplied, setPromoApplied] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/f/${formId}`)
        const json = await res.json()
        if (json.ok) setForm(json.data)
        else setError(json.error?.message || 'Form not found')
      } catch {
        setError('Failed to load form')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [formId])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    )
  }

  if (error || !form) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-600">{error || 'Form not found'}</p>
        </div>
      </div>
    )
  }

  const isTicketedForm = (form.ticketTypes?.length ?? 0) > 0

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: form.publicBgColor || '#f8fafc' }}>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">
            {isTicketedForm ? "You're all set!" : 'Thank you!'}
          </h2>
          <p className="text-sm text-slate-500">
            {form.confirmMessage || (isTicketedForm
              ? 'Your tickets have been sent to your email.'
              : 'Your response has been submitted successfully.'
            )}
          </p>
        </div>
      </div>
    )
  }

  // Filter visible fields
  const visiblePages = form.pages
    .filter((p) => p.fields.some((f) => f.isIncluded && f.sensitivityLevel !== 'FERPA_PROTECTED'))
    .map((p) => ({
      ...p,
      fields: p.fields.filter((f) => f.isIncluded && f.sensitivityLevel !== 'FERPA_PROTECTED'),
    }))

  // Ticket selector only renders if the form also has a TICKET_SELECTOR field on the canvas
  const hasTicketField = visiblePages.some((p) => p.fields.some((f) => f.type === 'TICKET_SELECTOR'))
  const showTicketSelector = isTicketedForm && hasTicketField

  function handleTicketQuantityChange(id: string, qty: number) {
    setTicketQuantities((prev) => ({ ...prev, [id]: qty }))
  }

  function handleApplyPromo() {
    if (!promoCode.trim()) return
    setPromoApplied(promoCode.trim().toUpperCase())
  }

  const formContent = (
    <FormContent
      form={form}
      visiblePages={visiblePages}
      currentPage={currentPage}
      setCurrentPage={setCurrentPage}
      values={values}
      setValues={setValues}
      email={email}
      setEmail={setEmail}
      validationErrors={validationErrors}
      setValidationErrors={setValidationErrors}
      submitting={submitting}
      setSubmitting={setSubmitting}
      setSubmitted={setSubmitted}
      // Ticket props — only passed when form has tickets
      {...(showTicketSelector ? {
        ticketTypes: form.ticketTypes,
        ticketQuantities,
        onTicketQuantityChange: handleTicketQuantityChange,
        hasDiscountCodes: form.hasDiscountCodes,
        promoCode,
        setPromoCode,
        promoApplied,
        onApplyPromo: handleApplyPromo,
      } : {})}
    />
  )

  const style = form.publicStyle || 'MINIMAL'
  const imageUrl = form.publicImageUrl
  const imageSide = form.publicImageSide || 'RIGHT'

  if (style === 'SPLIT' && imageUrl) {
    return <SplitLayout form={form} imageUrl={imageUrl} imageSide={imageSide}>{formContent}</SplitLayout>
  }
  if (style === 'HERO' && imageUrl) {
    return <HeroLayout form={form} imageUrl={imageUrl}>{formContent}</HeroLayout>
  }
  return <MinimalLayout form={form}>{formContent}</MinimalLayout>
}
