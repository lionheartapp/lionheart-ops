'use client'

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import PasswordInput from '@/components/PasswordInput'
import { validatePassword } from '@/lib/validation/password'

function SetPasswordContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = useMemo(() => searchParams.get('token') || '', [searchParams])

  const [loading, setLoading] = useState(true)
  const [valid, setValid] = useState(false)
  const [email, setEmail] = useState('')
  const [userStatus, setUserStatus] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const validate = async () => {
      if (!token) {
        setError('Missing setup token')
        setLoading(false)
        return
      }

      try {
        const res = await fetch(`/api/auth/set-password/validate?token=${encodeURIComponent(token)}`)
        const data = await res.json()
        if (!res.ok || !data.ok) {
          setError(data?.error?.message || 'Invalid setup link')
          setLoading(false)
          return
        }

        setValid(true)
        setEmail(data.data.email || '')
        setUserStatus(data.data.userStatus || '')
      } catch {
        setError('Failed to validate setup link')
      } finally {
        setLoading(false)
      }
    }

    validate()
  }, [token])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    const { valid } = validatePassword(password)
    if (!valid) {
      setError('Please fix the password requirements above')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data?.error?.message || 'Failed to set password')
        return
      }

      setSuccess(true)
      setTimeout(() => router.push('/login'), 1800)
    } catch {
      setError('Failed to set password')
    } finally {
      setSubmitting(false)
    }
  }

  // Error / invalid token state — use branded layout
  if (!loading && !valid) {
    return (
      <div className="flex min-h-screen">
        {/* Branded side panel */}
        <div className="hidden lg:flex lg:w-1/2 items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 relative overflow-hidden order-1">
          <div className="text-center px-12">
            <h1 className="text-5xl font-bold text-white mb-4">Lionheart</h1>
            <p className="text-xl text-slate-300 mb-12">Operations Platform</p>
            <img
              src="/logo-white.svg"
              alt="Lionheart"
              className="h-10 w-auto mx-auto opacity-60"
            />
          </div>
        </div>

        {/* Error content */}
        <div className="flex-1 flex items-center justify-center bg-white px-4 sm:px-6 lg:px-8 order-2">
          <div className="w-full max-w-md text-center">
            <div className="lg:hidden mb-8">
              <img src="/logo.svg" alt="Lionheart" className="h-12 w-auto mx-auto" />
            </div>
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
              <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Invalid setup link</h2>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              {error || 'This setup link is invalid or has expired.'}{' '}
              If you need a new link, please contact your administrator.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white text-sm font-semibold rounded-full hover:bg-slate-800 transition-colors duration-200"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      {/* Branded side panel */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 relative overflow-hidden order-1">
        <div className="text-center px-12">
          <h1 className="text-5xl font-bold text-white mb-4">Lionheart</h1>
          <p className="text-xl text-slate-300 mb-12">Operations Platform</p>
          <img
            src="/logo-white.svg"
            alt="Lionheart"
            className="h-10 w-auto mx-auto opacity-60"
          />
        </div>
      </div>

      {/* Form section */}
      <div className="flex-1 flex items-center justify-center bg-white px-4 sm:px-6 lg:px-8 order-2">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <img src="/logo.svg" alt="Lionheart" className="h-12 w-auto mx-auto" />
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Set your password</h2>
              <p className="mt-2 text-sm text-slate-600">
                Create a secure password for your account
              </p>
            </div>

            {loading ? (
              <div className="flex items-center gap-3 py-8">
                <div className="w-5 h-5 rounded-full border-2 border-slate-200 border-t-slate-600 animate-spin" />
                <p className="text-sm text-slate-600">Validating setup link...</p>
              </div>
            ) : success ? (
              <div className="space-y-3 py-4">
                <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                  <svg className="h-5 w-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  <p className="text-sm text-green-700 font-medium">Password set successfully.</p>
                </div>
                {userStatus !== 'ACTIVE' && (
                  <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <svg className="h-5 w-5 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                    </svg>
                    <p className="text-sm text-amber-700">Your account is pending approval. An admin must activate it before login.</p>
                  </div>
                )}
                <p className="text-sm text-slate-500">Redirecting to sign in...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-slate-600">Setting password for <span className="font-medium text-slate-900">{email}</span></p>
                <PasswordInput
                  value={password}
                  onChange={setPassword}
                  label="New Password"
                  id="sp-password"
                  required
                  autoComplete="new-password"
                />
                <div>
                  <label htmlFor="sp-confirm" className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password</label>
                  <input
                    id="sp-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-900/10 transition-colors duration-200"
                  />
                </div>

                {error && <p className="text-sm text-red-700" role="alert">{error}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full px-4 py-3.5 bg-slate-900 text-white text-sm font-semibold rounded-full hover:bg-slate-800 disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Set Password'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen">
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 to-slate-950" />
        <div className="flex-1 flex items-center justify-center bg-white px-4">
          <div className="w-5 h-5 rounded-full border-2 border-slate-200 border-t-slate-600 animate-spin" />
        </div>
      </div>
    }>
      <SetPasswordContent />
    </Suspense>
  )
}
