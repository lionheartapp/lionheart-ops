'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

interface SignupModalProps {
  onClose: () => void
}

export default function SignupModal({ onClose }: SignupModalProps) {
  const [step, setStep] = useState(1) // 1: School info, 2: Admin info, 3: Success
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const errorRef = useRef<HTMLDivElement>(null)
  const firstInputRef = useRef<HTMLInputElement>(null)

  // Step 1: School info
  const [schoolName, setSchoolName] = useState('')
  const [schoolType, setSchoolType] = useState<'ELEMENTARY' | 'MIDDLE_SCHOOL' | 'HIGH_SCHOOL' | 'GLOBAL'>('GLOBAL')
  const [slug, setSlug] = useState('')
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [checkingSlug, setCheckingSlug] = useState(false)

  // Step 2: Admin info
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Success
  const [createdOrg, setCreatedOrg] = useState<any>(null)

  // Generate slug from school name
  useEffect(() => {
    if (schoolName) {
      const generatedSlug = schoolName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      setSlug(generatedSlug)
      setSlugAvailable(null)
    }
  }, [schoolName])

  // Check slug availability
  useEffect(() => {
    if (!slug) {
      setSlugAvailable(null)
      return
    }

    const checkSlug = async () => {
      setCheckingSlug(true)
      try {
        const res = await fetch(`/api/organizations/slug-check?slug=${encodeURIComponent(slug)}`)
        const data = await res.json()
        setSlugAvailable(data.data?.valid ?? false)
      } catch (err) {
        setSlugAvailable(false)
      } finally {
        setCheckingSlug(false)
      }
    }

    const timeout = setTimeout(checkSlug, 500)
    return () => clearTimeout(timeout)
  }, [slug])

  // Focus first input when step changes
  useEffect(() => {
    if (firstInputRef.current && (step === 1 || step === 2)) {
      setTimeout(() => firstInputRef.current?.focus(), 0)
    }
  }, [step])

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!schoolName.trim()) {
      setError('School name is required')
      errorRef.current?.focus()
      return
    }

    if (!slug.trim()) {
      setError('Slug is required')
      errorRef.current?.focus()
      return
    }

    if (slugAvailable !== true) {
      setError('Slug is not available')
      errorRef.current?.focus()
      return
    }

    setStep(2)
  }

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!adminName.trim() || !adminEmail.trim() || !adminPassword.trim()) {
        throw new Error('All fields are required')
      }

      if (adminPassword !== confirmPassword) {
        throw new Error('Passwords do not match')
      }

      if (adminPassword.length < 8) {
        throw new Error('Password must be at least 8 characters')
      }

      const res = await fetch('/api/organizations/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: schoolName,
          schoolType,
          slug,
          adminEmail,
          adminName,
          adminPassword,
        }),
      })

      const data = await res.json()

      if (!data.ok) {
        throw new Error(data.error?.message || 'Signup failed')
      }

      setCreatedOrg(data.data)
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      errorRef.current?.focus()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" role="presentation">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full" role="dialog" aria-labelledby="modal-title" aria-modal="true">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
          <h2 id="modal-title" className="text-lg sm:text-xl font-bold text-gray-900">
            {step === 1 && 'Create Your School Account'}
            {step === 2 && 'Admin Account'}
            {step === 3 && 'Welcome!'}
          </h2>
          <button
            onClick={onClose}
            className="ui-icon-muted rounded p-1"
            aria-label="Close signup modal"
          >
            <X className="w-6 h-6" aria-hidden="true" />
          </button>
        </div>


        {/* Content */}
        <div className="p-4 sm:p-6">
          {step === 1 && (
            <form onSubmit={handleStep1Submit} className="space-y-4">
              {error && (
                <div
                  ref={errorRef}
                  className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3"
                  role="alert"
                  aria-live="polite"
                >
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div>
                <label htmlFor="school-name" className="block text-sm font-medium text-gray-700 mb-2">
                  School Name
                </label>
                <input
                  ref={firstInputRef}
                  id="school-name"
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="e.g., Mitchell Academy"
                  className="ui-input"
                  aria-describedby="school-name-hint"
                  required
                />
                <p id="school-name-hint" className="text-xs text-gray-500 mt-1">
                  Enter your school's official name
                </p>
              </div>

              <div>
                <label htmlFor="school-type" className="block text-sm font-medium text-gray-700 mb-2">
                  School Type
                </label>
                <select
                  id="school-type"
                  value={schoolType}
                  onChange={(e) => setSchoolType(e.target.value as 'ELEMENTARY' | 'MIDDLE_SCHOOL' | 'HIGH_SCHOOL' | 'GLOBAL')}
                  className="ui-input"
                >
                  <option value="ELEMENTARY">Elementary School</option>
                  <option value="MIDDLE_SCHOOL">Middle School</option>
                  <option value="HIGH_SCHOOL">High School</option>
                  <option value="GLOBAL">Global</option>
                </select>
              </div>

              <div>
                <label htmlFor="subdomain" className="block text-sm font-medium text-gray-700 mb-2">
                  Your Subdomain
                </label>
                <div className="relative">
                  <input
                    id="subdomain"
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="e.g., mitchell-academy"
                    className="ui-input pr-48"
                    aria-describedby="subdomain-hint subdomain-status"
                  />
                  <span className="absolute right-4 top-3 text-gray-500 text-sm pointer-events-none">
                    .lionheartapp.com
                  </span>
                </div>
                <div id="subdomain-hint" className="text-xs text-gray-500 mt-1">
                  3-50 characters, lowercase letters, numbers, and hyphens
                </div>
                <div
                  id="subdomain-status"
                  className="text-xs mt-2"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {checkingSlug && (
                    <div className="flex items-center gap-2 text-blue-600">
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      Checking availability...
                    </div>
                  )}
                  {!checkingSlug && slugAvailable === true && slug && (
                    <div className="text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Available
                    </div>
                  )}
                  {!checkingSlug && slugAvailable === false && slug && (
                    <div className="text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" aria-hidden="true" /> Not available
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={slugAvailable !== true || loading}
                className="w-full mt-6 px-4 py-3 min-h-[44px] bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
                aria-busy={loading}
              >
                Continue
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleStep2Submit} className="space-y-4">
              {error && (
                <div
                  ref={errorRef}
                  className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3"
                  role="alert"
                  aria-live="polite"
                >
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div>
                <label htmlFor="admin-name" className="block text-sm font-medium text-gray-700 mb-2">
                  Your Name
                </label>
                <input
                  ref={firstInputRef}
                  id="admin-name"
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="e.g., Sarah Mitchell"
                  className="ui-input"
                  required
                />
              </div>

              <div>
                <label htmlFor="admin-email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  id="admin-email"
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="e.g., principal@mitchell.edu"
                  className="ui-input"
                  required
                />
              </div>

              <div>
                <label htmlFor="admin-password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  id="admin-password"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="ui-input"
                  aria-describedby="password-hint"
                  required
                />
                <p id="password-hint" className="text-xs text-gray-500 mt-1">
                  At least 8 characters
                </p>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="ui-input"
                  required
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-3 min-h-[44px] border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-3 min-h-[44px] bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                  aria-busy={loading}
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                  Create Account
                </button>
              </div>
            </form>
          )}

          {step === 3 && createdOrg && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <CheckCircle2 className="w-16 h-16 text-green-500" aria-hidden="true" />
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Welcome, {createdOrg.admin?.name}!
                </h3>
                <p className="text-sm sm:text-base text-gray-600 mb-4">
                  Your school account is ready. You can now access your Lionheart dashboard.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left space-y-2">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">School:</span> {createdOrg.organizationName}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Subdomain:</span> {createdOrg.slug}.lionheartapp.com
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Email:</span> {createdOrg.admin?.email}
                </p>
              </div>

              <a
                href={createdOrg.loginUrl}
                className="block w-full px-4 py-3 min-h-[44px] bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition text-center"
                aria-label={`Go to ${createdOrg.organizationName} dashboard`}
              >
                Go to My Dashboard
              </a>

              <button
                onClick={onClose}
                className="w-full px-4 py-3 min-h-[44px] border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
