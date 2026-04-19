'use client'

import { useState, useRef, FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'

interface LoginFormProps {
  organizationId: string
  organizationName: string
}

export default function LoginForm({ organizationId, organizationName }: LoginFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Forgot password state
  const [forgotMode, setForgotMode] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)

  // MFA state
  const [mfaMode, setMfaMode] = useState(false)
  const [mfaToken, setMfaToken] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaLoading, setMfaLoading] = useState(false)
  const [mfaError, setMfaError] = useState('')
  const mfaInputRef = useRef<HTMLInputElement>(null)

  // ── Hydrate localStorage after successful login ──
  function hydrateSession(data: {
    token?: string
    organizationId?: string
    organization?: { name?: string; logoUrl?: string; gradeLevel?: string; onboardingStatus?: string }
    user?: { name?: string; email?: string; avatar?: string; team?: string; teamSlugs?: string[]; schoolScope?: string; role?: string }
  }) {
    localStorage.setItem('auth-token', data.token || 'cookie-auth')
    localStorage.setItem('org-id', data.organizationId || '')
    localStorage.setItem('user-name', data.user?.name || '')
    localStorage.setItem('user-email', data.user?.email || '')
    localStorage.setItem('user-avatar', data.user?.avatar || '')
    localStorage.setItem('user-team', data.user?.team || '')
    localStorage.setItem('user-team-slugs', JSON.stringify(data.user?.teamSlugs || []))
    localStorage.setItem('user-school-scope', data.user?.schoolScope || '')
    localStorage.setItem('user-role', data.user?.role || '')
    localStorage.setItem('org-name', data.organization?.name || '')
    localStorage.setItem('org-school-type', data.organization?.gradeLevel || '')
    localStorage.setItem('org-logo-url', data.organization?.logoUrl || '')

    // Prefetch modules so add-ons render instantly on first page load
    fetch('/api/modules', { credentials: 'include' })
      .then((res) => res.json())
      .then((json) => {
        if (json.ok && Array.isArray(json.data)) {
          localStorage.setItem('cached-modules', JSON.stringify(json.data))
        }
      })
      .catch(() => {})

    const onboardingStatus = data.organization?.onboardingStatus
    const isOnboarding = onboardingStatus === 'SIGNED_UP' || onboardingStatus === 'ONBOARDING'
    const redirectTo = searchParams.get('redirect') || (isOnboarding ? '/onboarding/school-info' : '/dashboard')
    router.push(redirectTo)
  }

  // ── Login submit ──
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, organizationId }),
      })

      const data = await res.json()

      if (!data.ok) {
        if (data.error?.code === 'EMAIL_NOT_VERIFIED') {
          const details = data.error?.details?.[0] as { email?: string; organizationId?: string } | undefined
          const params = new URLSearchParams()
          if (details?.email) params.set('email', details.email)
          if (details?.organizationId) params.set('organizationId', details.organizationId)
          router.push(`/verify-email?${params.toString()}`)
          return
        }
        setError(data.error?.message || 'Login failed')
        return
      }

      // Check if MFA is required
      if (data.data?.mfaRequired) {
        setMfaToken(data.data.mfaToken)
        setMfaMode(true)
        setMfaCode('')
        setMfaError('')
        // Auto-focus the code input after render
        setTimeout(() => mfaInputRef.current?.focus(), 100)
        return
      }

      hydrateSession(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  // ── MFA verify submit ──
  async function handleMfaSubmit(e: FormEvent) {
    e.preventDefault()
    setMfaError('')
    setMfaLoading(true)

    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfaToken, code: mfaCode.trim() }),
      })

      const data = await res.json()

      if (!data.ok) {
        if (data.error?.code === 'INVALID_TOKEN') {
          // Token expired — go back to password
          setMfaMode(false)
          setMfaToken('')
          setError('Your verification session expired. Please sign in again.')
          return
        }
        setMfaError(data.error?.message || 'Verification failed')
        return
      }

      hydrateSession(data.data)
    } catch (err) {
      setMfaError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setMfaLoading(false)
    }
  }

  // ── Forgot password handlers ──
  async function handleForgotSubmit(e: FormEvent) {
    e.preventDefault()
    setForgotLoading(true)

    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, organizationId }),
      })
      setForgotSent(true)
    } catch {
      setForgotSent(true)
    } finally {
      setForgotLoading(false)
    }
  }

  function handleBackToSignIn() {
    setForgotMode(false)
    setForgotEmail('')
    setForgotSent(false)
    setMfaMode(false)
    setMfaToken('')
    setMfaCode('')
    setMfaError('')
  }

  // ── MFA code entry mode ──
  if (mfaMode) {
    return (
      <form onSubmit={handleMfaSubmit} className="space-y-6">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-4">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Two-factor authentication</h2>
          <p className="text-sm text-slate-500">
            Enter the 6-digit code from your authenticator app, or use a backup code.
          </p>
        </div>

        <div>
          <label htmlFor="mfa-code" className="block text-sm font-medium text-slate-700 mb-1">
            Verification code
          </label>
          <input
            ref={mfaInputRef}
            id="mfa-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9A-Za-z-]/g, ''))}
            placeholder="000000"
            className="block w-full rounded-lg border border-slate-300 px-4 py-3 text-center text-lg font-mono tracking-[0.3em] text-slate-900 placeholder-slate-300 focus:border-slate-900 focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-900/10 transition-colors"
            required
            autoFocus
            maxLength={12}
          />
        </div>

        {mfaError && (
          <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {mfaError}
          </div>
        )}

        <button
          type="submit"
          disabled={mfaLoading || mfaCode.length < 6}
          className="w-full rounded-full bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {mfaLoading ? 'Verifying...' : 'Verify'}
        </button>

        <button
          type="button"
          onClick={handleBackToSignIn}
          className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
        >
          Back to sign in
        </button>
      </form>
    )
  }

  // ── Forgot password mode ──
  if (forgotMode) {
    if (forgotSent) {
      return (
        <div className="space-y-6">
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-4 text-sm text-green-800">
            <p className="font-medium">Check your email</p>
            <p className="mt-1">If an account exists for that email address, we sent a reset link. Check your inbox and spam folder.</p>
          </div>
          <button
            type="button"
            onClick={handleBackToSignIn}
            className="w-full text-sm text-slate-600 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 rounded cursor-pointer"
          >
            Back to sign in
          </button>
        </div>
      )
    }

    return (
      <form onSubmit={handleForgotSubmit} className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Reset your password</h2>
          <p className="text-sm text-slate-600 mb-4">
            Enter your email address and we&apos;ll send you a link to reset your password.
          </p>
          <label htmlFor="forgot-email" className="block text-sm font-medium text-slate-700">
            Email address
          </label>
          <input
            id="forgot-email"
            type="email"
            value={forgotEmail}
            onChange={(e) => setForgotEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1 block w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-900/10 transition-colors"
            required
            autoComplete="email"
            autoFocus
          />
        </div>

        <button
          type="submit"
          disabled={forgotLoading}
          className="w-full rounded-full bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {forgotLoading ? 'Sending...' : 'Send reset link'}
        </button>

        <button
          type="button"
          onClick={handleBackToSignIn}
          className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 rounded cursor-pointer"
        >
          Back to sign in
        </button>
      </form>
    )
  }

  // ── Normal sign in mode ──
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Email address
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1 block w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-900/10 transition-colors"
            required
            autoComplete="email"
            autoFocus
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <button
              type="button"
              onClick={() => {
                setForgotEmail(email)
                setForgotMode(true)
              }}
              className="text-sm text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative mt-1">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="block w-full rounded-lg border border-slate-300 px-4 py-3 pr-12 text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-900/10 transition-colors"
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <p className="font-medium">Sign in failed</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Signing in...' : `Sign in to ${organizationName}`}
      </button>

      <p className="text-center text-xs text-slate-500">
        You&apos;ll stay logged in while you&apos;re active
      </p>
    </form>
  )
}
