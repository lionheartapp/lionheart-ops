'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  Loader2, CheckCircle2, AlertTriangle, ChevronLeft,
  Laptop, Code, KeyRound, WifiIcon, Projector, HelpCircle,
  Zap, Droplets, Wind, Hammer, SprayCan, Trees,
  MapPin,
} from 'lucide-react'
import FormRenderer from '@/components/forms/FormRenderer'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import type { FormFieldData } from '@/components/forms/FormFieldRenderer'
import AiTicketIntakeDrawer from '@/components/it/AiTicketIntakeDrawer'

// ─── Types ────────────────────────────────────────────────────────────────────

interface QrResolution {
  organizationId: string
  organization: { id: string; name: string; slug: string; logoUrl: string | null }
  categoryKey: string | null
  aiAvailable: boolean
  location: {
    buildingId: string | null
    areaId: string | null
    roomId: string | null
    building: { id: string; name: string } | null
    area: { id: string; name: string } | null
    room: { id: string; roomNumber: string; displayName: string | null } | null
  }
  label: string
}

type PageState = 'loading' | 'error' | 'category-picker' | 'form' | 'submitted' | 'ai-chat'

// ─── Constants ────────────────────────────────────────────────────────────────

const IT_CATEGORIES = [
  { key: 'hardware', label: 'Hardware', icon: Laptop },
  { key: 'software', label: 'Software', icon: Code },
  { key: 'account_password', label: 'Account / Password', icon: KeyRound },
  { key: 'network', label: 'Network', icon: WifiIcon },
  { key: 'display_av', label: 'Display / A/V', icon: Projector },
  { key: 'other', label: 'Other', icon: HelpCircle },
]

const MAINTENANCE_CATEGORIES = [
  { key: 'electrical', label: 'Electrical', icon: Zap },
  { key: 'plumbing', label: 'Plumbing', icon: Droplets },
  { key: 'hvac', label: 'HVAC', icon: Wind },
  { key: 'structural', label: 'Structural', icon: Hammer },
  { key: 'custodial', label: 'Custodial', icon: SprayCan },
  { key: 'grounds', label: 'Grounds', icon: Trees },
]

const ALL_CATEGORIES = [...IT_CATEGORIES, ...MAINTENANCE_CATEGORIES]

// ─── Component ────────────────────────────────────────────────────────────────

export default function QrScanPage() {
  const { token } = useParams<{ token: string }>()

  const [state, setState] = useState<PageState>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [resolution, setResolution] = useState<QrResolution | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitterName, setSubmitterName] = useState('')
  const [formDefFields, setFormDefFields] = useState<FormFieldData[]>([])
  const [formFieldResponses, setFormFieldResponses] = useState<Record<string, unknown>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [ticketNumber, setTicketNumber] = useState('')

  // Resolve QR token
  useEffect(() => {
    if (!token) return
    fetch(`/api/public/forms/qr/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setResolution(data.data)
          if (data.data.aiAvailable) {
            // AI available — use conversational intake
            setState('ai-chat')
          } else if (data.data.categoryKey) {
            setSelectedCategory(data.data.categoryKey)
            setState('form')
          } else {
            setState('category-picker')
          }
        } else {
          setErrorMessage(data.error?.message ?? 'This QR code is no longer active.')
          setState('error')
        }
      })
      .catch(() => {
        setErrorMessage('Could not load this page. Check your connection.')
        setState('error')
      })
  }, [token])

  // Fetch form definition fields when category is selected
  useEffect(() => {
    if (!selectedCategory || !resolution?.organizationId) return
    fetch(`/api/public/forms/category/${selectedCategory}?orgId=${resolution.organizationId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.data?.fields) {
          setFormDefFields(data.data.fields)
        }
      })
      .catch(() => {})
  }, [selectedCategory, resolution?.organizationId])

  // Submit ticket
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !description.trim()) return
    setSubmitting(true)
    setSubmitError('')

    try {
      const res = await fetch(`/api/public/tickets/qr/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          categoryKey: selectedCategory,
          priority: 'Normal',
          submitterName: submitterName.trim() || undefined,
          customFields: Object.keys(formFieldResponses).length > 0
            ? formFieldResponses
            : undefined,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setTicketNumber(data.data.ticketNumber)
        setState('submitted')
      } else {
        setSubmitError(data.error?.message ?? 'Failed to submit.')
      }
    } catch {
      setSubmitError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const locationLabel = resolution?.location
    ? [
        resolution.location.building?.name,
        resolution.location.area?.name,
        resolution.location.room?.displayName ?? resolution.location.room?.roomNumber,
      ]
        .filter(Boolean)
        .join(' — ')
    : null

  const orgName = resolution?.organization?.name ?? 'School'

  return (
    <div className="min-h-screen bg-[#f5f4f0] flex items-start justify-center p-4 pt-8 md:pt-16">
      <div className="w-full max-w-md">
        {/* Org branding */}
        {resolution && (
          <div className="text-center mb-5">
            {resolution.organization.logoUrl && (
              <img
                src={resolution.organization.logoUrl}
                alt=""
                className="w-10 h-10 rounded-xl mx-auto mb-2 object-cover"
              />
            )}
            <h1 className="text-lg font-bold text-[#1a1915]">{orgName}</h1>
            <p className="text-sm text-[#6a6864]">Report an Issue</p>
          </div>
        )}

        {/* Location pill */}
        {locationLabel && state !== 'submitted' && (
          <div className="flex items-center justify-center gap-1.5 mb-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[rgba(17,15,10,0.08)] text-sm text-[#1a1915]">
              <MapPin className="w-3.5 h-3.5 text-[#a8a49d]" />
              {locationLabel}
            </div>
          </div>
        )}

        {/* Loading */}
        {state === 'loading' && (
          <div className="bg-white rounded-2xl border border-[rgba(17,15,10,0.08)] p-8 text-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
            <p className="text-sm text-[#6a6864]">Loading...</p>
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div className="bg-white rounded-2xl border border-[rgba(17,15,10,0.08)] p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-base font-semibold text-[#1a1915] mb-1">QR Code Issue</h2>
            <p className="text-sm text-[#6a6864]">{errorMessage}</p>
          </div>
        )}

        {/* Category picker */}
        {state === 'category-picker' && (
          <div className="bg-white rounded-2xl border border-[rgba(17,15,10,0.08)] p-6">
            <p className="text-sm text-[#6a6864] mb-3">What kind of issue?</p>
            <div className="grid grid-cols-2 gap-2">
              {ALL_CATEGORIES.map((cat) => {
                const Icon = cat.icon
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat.key)
                      setState('form')
                    }}
                    className="flex flex-col items-center gap-1.5 p-4 rounded-xl border border-[rgba(17,15,10,0.08)] bg-white hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer transition-all duration-200"
                  >
                    <Icon className="w-5 h-5 text-[#6a6864]" />
                    <span className="text-xs font-medium text-[#1a1915] text-center leading-tight">
                      {cat.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Form */}
        {state === 'form' && (
          <div>
            {!resolution?.categoryKey && (
              <button
                type="button"
                onClick={() => {
                  setState('category-picker')
                  setSelectedCategory(null)
                  setFormDefFields([])
                  setFormFieldResponses({})
                }}
                className="flex items-center gap-1 text-sm text-[#6a6864] hover:text-[#1a1915] mb-3 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Change category
              </button>
            )}

            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-2xl border border-[rgba(17,15,10,0.08)] p-6 space-y-4"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs uppercase tracking-wider text-[#a8a49d] font-semibold capitalize">
                  {selectedCategory?.replace(/_/g, ' ')} issue
                </span>
              </div>

              {/* Your name (optional) */}
              <div>
                <label className="block text-sm font-medium text-[#1a1915] mb-1">
                  Your name <span className="text-[#a8a49d] font-normal">(optional)</span>
                </label>
                <Input
                  type="text"
                  value={submitterName}
                  onChange={(e) => setSubmitterName(e.target.value)}
                  placeholder="So the team knows who submitted"
                  className="w-full text-sm text-[#1a1915] placeholder:text-[#a8a49d] focus:border-blue-400/60 focus:ring-blue-400/20"
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-[#1a1915] mb-1">
                  What&apos;s the issue? <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Brief summary"
                  required
                  className="w-full text-sm text-[#1a1915] placeholder:text-[#a8a49d] focus:border-blue-400/60 focus:ring-blue-400/20"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-[#1a1915] mb-1">
                  Details <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What happened? What have you tried?"
                  required
                  rows={3}
                  className="w-full text-sm text-[#1a1915] placeholder:text-[#a8a49d] focus:border-blue-400/60 focus:ring-blue-400/20 resize-none"
                />
              </div>

              {/* Dynamic form fields */}
              {formDefFields.length > 0 && (
                <FormRenderer
                  fields={formDefFields}
                  responses={formFieldResponses}
                  setResponses={setFormFieldResponses}
                />
              )}

              {submitError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !title.trim() || !description.trim()}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[#1a1915] text-white text-sm font-semibold hover:bg-[#2a2925] disabled:opacity-50 transition-all active:scale-[0.97] cursor-pointer"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit Report
              </button>
            </form>
          </div>
        )}

        {/* Submitted */}
        {state === 'submitted' && (
          <div className="bg-white rounded-2xl border border-[rgba(17,15,10,0.08)] p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            </div>
            <h2 className="text-base font-semibold text-[#1a1915] mb-1">Submitted</h2>
            <p className="text-sm text-[#6a6864] mb-1">
              Ticket <span className="font-mono font-semibold">{ticketNumber}</span> has been created.
            </p>
            <p className="text-xs text-[#a8a49d] mb-4">
              The team will be notified and will address the issue.
            </p>
            <button
              type="button"
              onClick={() => {
                setTitle('')
                setDescription('')
                setSubmitterName('')
                setFormFieldResponses({})
                setSubmitError('')
                if (resolution?.categoryKey) {
                  setState('form')
                } else {
                  setSelectedCategory(null)
                  setFormDefFields([])
                  setState('category-picker')
                }
              }}
              className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              Submit another
            </button>
          </div>
        )}

        {/* AI Chat mode */}
        {state === 'ai-chat' && resolution && (
          <AiTicketIntakeDrawer
            isOpen={true}
            onClose={() => setState('loading')}
            source="QR_CODE"
            prefilledLocation={locationLabel}
            prefilledCategory={resolution.categoryKey}
            orgId={resolution.organizationId}
            onTicketCreated={(num) => {
              setTicketNumber(num)
              setState('submitted')
            }}
          />
        )}

        {/* Footer */}
        <p className="text-center text-[10px] text-[#a8a49d] mt-6">
          Powered by Lionheart
        </p>
      </div>
    </div>
  )
}
