'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Monitor, CheckCircle2, AlertTriangle, Loader2,
  Wrench, Wifi, Phone, ChevronLeft,
  Laptop, Code, KeyRound, WifiIcon, Projector, HelpCircle,
  Zap, Droplets, Wind, Hammer, SprayCan, Trees,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface TokenValidation {
  valid: boolean
  campus?: { id: string; name: string }
  school?: { id: string; name: string }
  expiresAt: string
}

type ActiveView = 'hub' | 'it-form' | 'maintenance-form' | 'wifi' | 'submitted'

// ─── Constants ───────────────────────────────────────────────────────────────

const IT_ISSUE_TYPES = [
  { value: 'HARDWARE', label: 'Hardware', icon: Laptop },
  { value: 'SOFTWARE', label: 'Software', icon: Code },
  { value: 'ACCOUNT_PASSWORD', label: 'Account / Password', icon: KeyRound },
  { value: 'NETWORK', label: 'Network', icon: WifiIcon },
  { value: 'DISPLAY_AV', label: 'Display / A/V', icon: Projector },
  { value: 'OTHER', label: 'Other', icon: HelpCircle },
]

const MAINTENANCE_CATEGORIES = [
  { value: 'ELECTRICAL', label: 'Electrical', icon: Zap },
  { value: 'PLUMBING', label: 'Plumbing', icon: Droplets },
  { value: 'HVAC', label: 'HVAC', icon: Wind },
  { value: 'STRUCTURAL', label: 'Structural', icon: Hammer },
  { value: 'CUSTODIAL_BIOHAZARD', label: 'Custodial', icon: SprayCan },
  { value: 'GROUNDS', label: 'Grounds', icon: Trees },
  { value: 'OTHER', label: 'Other', icon: HelpCircle },
]

// ─── Main Component ──────────────────────────────────────────────────────────

function SubFormContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [validation, setValidation] = useState<TokenValidation | null>(null)
  const [validating, setValidating] = useState(true)
  const [tokenError, setTokenError] = useState('')
  const [activeView, setActiveView] = useState<ActiveView>('hub')

  // IT form state
  const [roomText, setRoomText] = useState('')
  const [issueType, setIssueType] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [ticketNumber, setTicketNumber] = useState('')

  // Maintenance form state
  const [maintCategory, setMaintCategory] = useState('')
  const [maintTitle, setMaintTitle] = useState('')
  const [maintDescription, setMaintDescription] = useState('')

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setTokenError('No access link provided. Please use the link given to you by your school.')
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

  const handleITSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !roomText.trim() || !issueType || !description.trim()) return

    setSubmitting(true)
    setSubmitError('')

    try {
      const res = await fetch('/api/it/tickets/sub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, roomText: roomText.trim(), issueType, description: description.trim() }),
      })

      const data = await res.json()
      if (data.ok) {
        setTicketNumber(data.data.ticketNumber)
        setActiveView('submitted')
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

  const schoolName = validation?.school?.name || validation?.campus?.name || 'School'

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Loading */}
        {validating && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500">Validating your access...</p>
          </div>
        )}

        {/* Token error */}
        {!validating && tokenError && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-base font-semibold text-slate-900 mb-1">Link Issue</h2>
            <p className="text-sm text-slate-600">{tokenError}</p>
          </div>
        )}

        {/* Success */}
        {activeView === 'submitted' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            </div>
            <h2 className="text-base font-semibold text-slate-900 mb-1">Request Submitted!</h2>
            <p className="text-sm text-slate-600 mb-2">
              Ticket <span className="font-mono font-medium">{ticketNumber}</span> has been created.
            </p>
            <p className="text-xs text-slate-400 mb-4">
              The team will be notified and will address the issue as soon as possible.
            </p>
            <button
              onClick={() => setActiveView('hub')}
              className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              Back to Home
            </button>
          </div>
        )}

        {/* ═══ Hub ═══ */}
        {!validating && !tokenError && activeView === 'hub' && validation && (
          <div className="space-y-4">
            {/* Header */}
            <div className="text-center mb-2">
              <h1 className="text-xl font-bold text-slate-900">Welcome to {schoolName}</h1>
              <p className="text-sm text-slate-500 mt-1">What do you need help with?</p>
            </div>

            {/* IT Request */}
            <button
              onClick={() => setActiveView('it-form')}
              className="w-full flex items-center gap-4 p-5 bg-white rounded-2xl shadow-sm border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer text-left group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                <Monitor className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">Report IT Issue</h3>
                <p className="text-xs text-slate-500">Computer, printer, projector, Wi-Fi, or software problem</p>
              </div>
            </button>

            {/* Maintenance Request */}
            <button
              onClick={() => setActiveView('maintenance-form')}
              className="w-full flex items-center gap-4 p-5 bg-white rounded-2xl shadow-sm border border-slate-200 hover:border-orange-300 hover:shadow-md transition-all cursor-pointer text-left group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                <Wrench className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 group-hover:text-orange-700 transition-colors">Report Facilities Issue</h3>
                <p className="text-xs text-slate-500">Plumbing, electrical, HVAC, cleaning, or building problem</p>
              </div>
            </button>

            {/* Wi-Fi Info */}
            <button
              onClick={() => setActiveView('wifi')}
              className="w-full flex items-center gap-4 p-5 bg-white rounded-2xl shadow-sm border border-slate-200 hover:border-green-300 hover:shadow-md transition-all cursor-pointer text-left group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                <Wifi className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 group-hover:text-green-700 transition-colors">Connect to Wi-Fi</h3>
                <p className="text-xs text-slate-500">Guest network name and password</p>
              </div>
            </button>

            {/* Contact Info */}
            <div className="flex items-center gap-4 p-5 bg-white rounded-2xl shadow-sm border border-slate-200">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                <Phone className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Need Immediate Help?</h3>
                <p className="text-xs text-slate-500">Contact the front office for urgent matters</p>
              </div>
            </div>

            <p className="text-xs text-slate-400 text-center">
              Access expires: {new Date(validation.expiresAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
        )}

        {/* ═══ IT Form ═══ */}
        {activeView === 'it-form' && validation && (
          <div>
            <button
              onClick={() => setActiveView('hub')}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            <form onSubmit={handleITSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <Monitor className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">IT Help Request</h2>
                  <p className="text-xs text-slate-500">Describe your technology issue</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Room / Location *</label>
                <input
                  type="text"
                  value={roomText}
                  onChange={(e) => setRoomText(e.target.value)}
                  placeholder="e.g., Room 204, Library, Gym"
                  required
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">What type of issue? *</label>
                <div className="grid grid-cols-3 gap-2">
                  {IT_ISSUE_TYPES.map((type) => {
                    const Icon = type.icon
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setIssueType(type.value)}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all cursor-pointer ${
                          issueType === type.value
                            ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <Icon className="w-5 h-5 text-slate-600" />
                        <span className="text-xs font-medium text-slate-700 text-center leading-tight">{type.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Describe the problem *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's happening? What have you tried?"
                  required
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 resize-none"
                />
              </div>

              {submitError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>
              )}

              <button
                type="submit"
                disabled={submitting || !roomText.trim() || !issueType || !description.trim()}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 transition-all active:scale-[0.97] shadow-sm cursor-pointer"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit IT Request
              </button>
            </form>
          </div>
        )}

        {/* ═══ Maintenance Form ═══ */}
        {activeView === 'maintenance-form' && validation && (
          <div>
            <button
              onClick={() => setActiveView('hub')}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (!token || !roomText.trim() || !maintCategory || !maintTitle.trim()) return
                setSubmitting(true)
                setSubmitError('')
                try {
                  const res = await fetch('/api/it/tickets/sub', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      token,
                      roomText: roomText.trim(),
                      issueType: 'OTHER',
                      description: `[MAINTENANCE - ${maintCategory}] ${maintTitle.trim()}${maintDescription ? '\n\n' + maintDescription.trim() : ''}`,
                    }),
                  })
                  const data = await res.json()
                  if (data.ok) {
                    setTicketNumber(data.data.ticketNumber)
                    setActiveView('submitted')
                  } else {
                    setSubmitError(data.error?.message || 'Failed to submit request.')
                  }
                } catch {
                  setSubmitError('Network error. Please try again.')
                } finally {
                  setSubmitting(false)
                }
              }}
              className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
                  <Wrench className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Facilities Request</h2>
                  <p className="text-xs text-slate-500">Report a building or maintenance issue</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Room / Location *</label>
                <input
                  type="text"
                  value={roomText}
                  onChange={(e) => setRoomText(e.target.value)}
                  placeholder="e.g., Room 204, Library, Gym"
                  required
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/40"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Category *</label>
                <div className="grid grid-cols-3 gap-2">
                  {MAINTENANCE_CATEGORIES.map((cat) => {
                    const Icon = cat.icon
                    return (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setMaintCategory(cat.value)}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all cursor-pointer ${
                          maintCategory === cat.value
                            ? 'border-orange-400 bg-orange-50 ring-2 ring-orange-200'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <Icon className="w-5 h-5 text-slate-600" />
                        <span className="text-xs font-medium text-slate-700 text-center leading-tight">{cat.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">What&apos;s the issue? *</label>
                <input
                  type="text"
                  value={maintTitle}
                  onChange={(e) => setMaintTitle(e.target.value)}
                  placeholder="e.g., Leaking faucet, broken window, no heat"
                  required
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/40"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Details <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={maintDescription}
                  onChange={(e) => setMaintDescription(e.target.value)}
                  placeholder="Any additional details..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/40 resize-none"
                />
              </div>

              {submitError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>
              )}

              <button
                type="submit"
                disabled={submitting || !roomText.trim() || !maintCategory || !maintTitle.trim()}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-orange-500 to-amber-600 text-white text-sm font-semibold hover:from-orange-600 hover:to-amber-700 disabled:opacity-50 transition-all active:scale-[0.97] shadow-sm cursor-pointer"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit Facilities Request
              </button>
            </form>
          </div>
        )}

        {/* ═══ Wi-Fi Info ═══ */}
        {activeView === 'wifi' && validation && (
          <div>
            <button
              onClick={() => setActiveView('hub')}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <Wifi className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Wi-Fi Access</h2>
                  <p className="text-xs text-slate-500">Connect to the guest network</p>
                </div>
              </div>

              <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                <div className="mb-3">
                  <span className="text-xs font-medium text-green-700 uppercase tracking-wide">Network Name</span>
                  <p className="text-lg font-mono font-semibold text-slate-900 mt-0.5">{schoolName}-Guest</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-green-700 uppercase tracking-wide">Password</span>
                  <p className="text-lg font-mono font-semibold text-slate-900 mt-0.5">Welcome2025</p>
                </div>
              </div>

              <div className="text-xs text-slate-500 space-y-1">
                <p>1. Open your device&apos;s Wi-Fi settings</p>
                <p>2. Select the network above</p>
                <p>3. Enter the password exactly as shown</p>
              </div>

              <p className="text-xs text-slate-400">
                Having trouble? Submit an IT request from the home screen.
              </p>
            </div>
          </div>
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
