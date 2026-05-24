'use client'

import { useState } from 'react'
import { Calendar, MapPin, Loader2, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { readableTextColor } from '@/lib/forms/schemas'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EventInfo {
  title: string
  description: string | null
  locationText: string | null
  startsAt: string | null
  endsAt: string | null
  coverImageUrl: string | null
}

interface OrgInfo {
  name: string
  logoUrl: string | null
  slug: string
}

interface FieldInfo {
  id: string
  label: string
  inputType: string
  required: boolean
  helpText: string | null
  placeholder: string | null
  options: unknown
  sortOrder: number
}

interface SectionInfo {
  id: string
  title: string
  sortOrder: number
  fields: FieldInfo[]
}

interface PublicRegistrationFormProps {
  eventSlug: string
  event: EventInfo
  org: OrgInfo
  sections: SectionInfo[]
  publicStyle: string | null
  publicCtaColor: string
  publicBgColor: string
  publicImageUrl: string | null
  publicImageSide: string | null
  status: string
}

// ─── Field Renderer ───────────────────────────────────────────────────────────

function PublicField({
  field,
  value,
  onChange,
}: {
  field: FieldInfo
  value: string
  onChange: (v: string) => void
}) {
  const t = field.inputType

  if (t === 'TEXT' || t === 'EMAIL' || t === 'PHONE') {
    return (
      <Input
        type={t === 'EMAIL' ? 'email' : t === 'PHONE' ? 'tel' : 'text'}
        placeholder={field.placeholder || ''}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
      />
    )
  }

  if (t === 'TEXTAREA') {
    return (
      <Textarea
        rows={3}
        placeholder={field.placeholder || ''}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
      />
    )
  }

  if (t === 'NUMBER') {
    return (
      <Input
        type="number"
        placeholder={field.placeholder || ''}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
      />
    )
  }

  if (t === 'DATE') {
    return (
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
      />
    )
  }

  if (t === 'DROPDOWN' || t === 'GRADE_SELECTOR') {
    const opts = Array.isArray(field.options)
      ? (field.options as Array<{ label: string; value: string }>)
      : []
    return (
      <Select
        value={value}
        onChange={onChange}
        options={[
          { value: '', label: field.placeholder || 'Select...' },
          ...opts,
        ]}
      />
    )
  }

  if (t === 'CHECKBOX') {
    return (
      <Checkbox
        checked={value === 'true'}
        onChange={(e) => onChange(e.target.checked ? 'true' : '')}
        label="Yes"
      />
    )
  }

  return (
    <Input
      type="text"
      placeholder={field.placeholder || ''}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

// ─── Image Panel ──────────────────────────────────────────────────────────────

function ImagePanel({
  imageUrl,
  orgName,
  eventTitle,
  className,
  style: panelStyle,
}: {
  imageUrl: string | null
  orgName: string
  eventTitle: string
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      className={`relative overflow-hidden bg-[#e8e6e1] ${className ?? ''}`}
      style={panelStyle}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-indigo-600" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
      <div className="relative z-10 flex flex-col justify-end h-full w-full p-6 text-white">
        <div className="text-[11px] uppercase tracking-widest opacity-80">{orgName}</div>
        <div className="text-xl md:text-2xl font-bold drop-shadow leading-tight mt-0.5">{eventTitle}</div>
      </div>
    </div>
  )
}

// ─── Logo ─────────────────────────────────────────────────────────────────────

function OrgLogo({ org, ctaColor }: { org: OrgInfo; ctaColor: string }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      {org.logoUrl ? (
        <img src={org.logoUrl} alt="" className="h-8 w-8 rounded-xl object-cover" />
      ) : (
        <div className="h-8 w-8 rounded-xl" style={{ backgroundColor: ctaColor }} />
      )}
      <div className="font-semibold text-[#1a1915]">{org.name}</div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PublicRegistrationForm({
  eventSlug,
  event,
  org,
  sections,
  publicStyle,
  publicCtaColor,
  publicBgColor,
  publicImageUrl,
  publicImageSide,
  status,
}: PublicRegistrationFormProps) {
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const ctaText = readableTextColor(publicCtaColor)
  const style = publicStyle ?? 'MINIMAL'
  const imageSide = publicImageSide ?? 'RIGHT'

  const dateLabel = event.startsAt
    ? new Date(event.startsAt).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      })
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError('')
    try {
      const responseArray = Object.entries(responses)
        .filter(([, v]) => v !== '')
        .map(([fieldId, value]) => ({ fieldId, value }))

      const res = await fetch(`/api/events/register/${eventSlug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turnstileToken: 'bypass',
          firstName: responses._firstName ?? '',
          lastName: responses._lastName ?? '',
          email: responses._email ?? '',
          responses: responseArray,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setSubmitted(true)
      } else {
        setSubmitError(data.error?.message ?? 'Registration failed.')
      }
    } catch {
      setSubmitError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Status screens ─────────────────────────────────────────────────────

  if (status === 'not_open_yet') {
    return (
      <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-[rgba(17,15,10,0.08)] p-8 text-center max-w-md">
          <Clock className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-[#1a1915] mb-1">Registration Opens Soon</h2>
          <p className="text-sm text-[#6a6864]">{event.title}</p>
        </div>
      </div>
    )
  }

  if (status === 'closed') {
    return (
      <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-[rgba(17,15,10,0.08)] p-8 text-center max-w-md">
          <XCircle className="w-10 h-10 text-[#a8a49d] mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-[#1a1915] mb-1">Registration Closed</h2>
          <p className="text-sm text-[#6a6864]">{event.title}</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-[rgba(17,15,10,0.08)] p-8 text-center max-w-md">
          <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-[#1a1915] mb-1">Registered!</h2>
          <p className="text-sm text-[#6a6864]">
            You&apos;re signed up for <span className="font-semibold">{event.title}</span>.
          </p>
          <p className="text-xs text-[#a8a49d] mt-1">A confirmation email has been sent.</p>
        </div>
      </div>
    )
  }

  // ─── Form body (reused across layouts) ──────────────────────────────────

  const formBody = (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#a8a49d]">{org.name}</div>
        <h2 className="text-2xl font-bold text-[#1a1915] leading-tight mt-1">{event.title}</h2>
        {(dateLabel || event.locationText) && (
          <div className="flex flex-wrap gap-3 mt-2 text-sm text-[#6a6864]">
            {dateLabel && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{dateLabel}</span>}
            {event.locationText && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{event.locationText}</span>}
          </div>
        )}
      </div>

      {sections.map((section) => (
        <div key={section.id} className="space-y-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#a8a49d]">{section.title}</div>
          {section.fields.map((field) => (
            <div key={field.id} className="space-y-1.5">
              <label className="text-sm font-medium text-[#1a1915]">
                {field.label}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <PublicField
                field={field}
                value={responses[field.id] ?? ''}
                onChange={(v) => setResponses((prev) => ({ ...prev, [field.id]: v }))}
              />
              {field.helpText && <p className="text-xs text-[#6a6864]">{field.helpText}</p>}
            </div>
          ))}
        </div>
      ))}

      {submitError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>
      )}

      <button
        type="submit"
        disabled={submitting}
        style={{ backgroundColor: publicCtaColor, color: ctaText }}
        className="w-full rounded-full px-4 py-3 text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.97]"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        Register
      </button>

      <div className="text-[11px] text-center text-[#a8a49d]">Powered by Lionheart</div>
    </form>
  )

  // ─── MINIMAL ────────────────────────────────────────────────────────────

  if (style === 'MINIMAL') {
    return (
      <div className="min-h-screen flex items-start justify-center p-4 pt-8 md:pt-16" style={{ backgroundColor: publicBgColor }}>
        <div className="w-full max-w-md bg-white rounded-2xl border border-[rgba(17,15,10,0.08)] shadow-[0_4px_18px_rgba(0,0,0,0.04)] p-8">
          <OrgLogo org={org} ctaColor={publicCtaColor} />
          {formBody}
        </div>
      </div>
    )
  }

  // ─── SPLIT ──────────────────────────────────────────────────────────────

  if (style === 'SPLIT') {
    const img = <ImagePanel imageUrl={publicImageUrl} orgName={org.name} eventTitle={event.title} className="min-h-[260px] md:min-h-0" />
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#fafaf9] to-[#f0eeea] flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-5xl bg-white rounded-2xl border border-[rgba(17,15,10,0.08)] shadow-[0_4px_18px_rgba(0,0,0,0.04)] overflow-hidden grid grid-cols-1 md:grid-cols-2" style={{ minHeight: 640 }}>
          {imageSide === 'LEFT' && img}
          <div className="p-8 md:p-10 flex flex-col justify-center">
            <OrgLogo org={org} ctaColor={publicCtaColor} />
            {formBody}
          </div>
          {imageSide === 'RIGHT' && img}
        </div>
      </div>
    )
  }

  // ─── HERO ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fafaf9] to-[#f0eeea] flex items-start justify-center p-4 pt-8 md:pt-16">
      <div className="w-full max-w-3xl bg-white rounded-2xl border border-[rgba(17,15,10,0.08)] shadow-[0_4px_18px_rgba(0,0,0,0.04)] overflow-hidden">
        <ImagePanel imageUrl={publicImageUrl} orgName={org.name} eventTitle={event.title} style={{ height: 260 }} />
        <div className="p-8 md:p-10">
          <OrgLogo org={org} ctaColor={publicCtaColor} />
          {formBody}
        </div>
      </div>
    </div>
  )
}
