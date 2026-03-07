'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Monitor, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'

interface TokenValidation {
  valid: boolean
  campus?: { id: string; name: string }
  school?: { id: string; name: string }
  expiresAt: string
}

const ISSUE_TYPES = [
  { value: 'HARDWARE', label: 'Hardware Issue', description: 'Computer, printer, keyboard, mouse, etc.' },
  { value: 'SOFTWARE', label: 'Software Issue', description: 'App not working, error messages, etc.' },
  { value: 'ACCOUNT_PASSWORD', label: 'Account / Password', description: 'Can\'t log in, locked out, need access' },
  { value: 'NETWORK', label: 'Network / Internet', description: 'No WiFi, slow connection, can\'t connect' },
  { value: 'DISPLAY_AV', label: 'Display / A/V', description: 'Projector, smartboard, speakers, Apple TV' },
  { value: 'OTHER', label: 'Other', description: 'Anything else IT-related' },
]

function SubFormContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [validation, setValidation] = useState<TokenValidation | null>(null)
  const [validating, setValidating] = useState(true)
  const [tokenError, setTokenError] = useState('')

  const [roomText, setRoomText] = useState('')
  const [issueType, setIssueType] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [ticketNumber, setTicketNumber] = useState('')

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setTokenError('No token provided. Please use the link given to you by your school.')
      setValidating(false)
      return
    }

    fetch(`/api/it/magic-links/${token}/validate`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.data?.valid) {
          setValidation(data.data)
        } else {
          const code = data.error?.code
          if (code === 'TOKEN_EXPIRED') setTokenError('This link has expired. Please ask the front office for a new one.')
          else if (code === 'TOKEN_USED') setTokenError('This link has already been used.')
          else setTokenError('This link is invalid. Please ask the front office for a new one.')
        }
        setValidating(false)
      })
      .catch(() => {
        setTokenError('Could not validate the link. Please check your connection and try again.')
        setValidating(false)
      })
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !roomText.trim() || !issueType || !description.trim()) return

    setSubmitting(true)
    setSubmitError('')

    try {
      const res = await fetch('/api/it/tickets/sub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          roomText: roomText.trim(),
          issueType,
          description: description.trim(),
        }),
      })

      const data = await res.json()
      if (data.ok) {
        setTicketNumber(data.data.ticketNumber)
        setSubmitted(true)
      } else {
        const code = data.error?.code
        if (code === 'TOKEN_EXPIRED') setSubmitError('This link has expired.')
        else if (code === 'TOKEN_USED') setSubmitError('This link has already been used.')
        else setSubmitError(data.error?.message || 'Failed to submit request.')
      }
    } catch {
      setSubmitError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / branding */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-lg">
            <Monitor className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">IT Help Request</h1>
          <p className="text-sm text-gray-500 mt-1">Submit a technology issue for IT support</p>
        </div>

        {/* Loading */}
        {validating && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Validating your link...</p>
          </div>
        )}

        {/* Token error */}
        {!validating && tokenError && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Link Issue</h2>
            <p className="text-sm text-gray-600">{tokenError}</p>
          </div>
        )}

        {/* Success */}
        {submitted && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Request Submitted!</h2>
            <p className="text-sm text-gray-600 mb-2">
              Your IT request <span className="font-mono font-medium">{ticketNumber}</span> has been submitted.
            </p>
            <p className="text-xs text-gray-400">
              The IT team will be notified and will address the issue as soon as possible.
            </p>
          </div>
        )}

        {/* Form */}
        {!validating && !tokenError && !submitted && validation && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
            {validation.school && (
              <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                Campus: <span className="font-medium text-gray-700">{validation.school.name}</span>
              </div>
            )}

            {/* Room */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Room Number *</label>
              <input
                type="text"
                value={roomText}
                onChange={(e) => setRoomText(e.target.value)}
                placeholder="e.g., Room 204, Library, Gym"
                required
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300"
              />
            </div>

            {/* Issue type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">What&apos;s the issue? *</label>
              <div className="grid grid-cols-2 gap-2">
                {ISSUE_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setIssueType(type.value)}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      issueType === type.value
                        ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-400/30'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-sm font-medium text-gray-900 block">{type.label}</span>
                    <span className="text-[10px] text-gray-500 leading-tight">{type.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Describe the problem *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's happening? What have you tried?"
                required
                rows={4}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 resize-none"
              />
            </div>

            {submitError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !roomText.trim() || !issueType || !description.trim()}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.97] shadow-sm"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit IT Request
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function SubTicketPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    }>
      <SubFormContent />
    </Suspense>
  )
}
