'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, ShieldCheck, Fingerprint, KeyRound, Mail } from 'lucide-react'
import { WebAuthnAbortService, startAuthentication } from '@simplewebauthn/browser'
import { Input } from '@/components/ui/Input'

interface LoginFormProps {
  organizationId: string
  organizationName: string
}

const PASSKEY_AUTH_TIMEOUT_MS = 30000

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
  const [hasPasskeys, setHasPasskeys] = useState(false)
  const [hasTotp, setHasTotp] = useState(false)
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [emailOtpMode, setEmailOtpMode] = useState(false)
  const [emailOtpSending, setEmailOtpSending] = useState(false)
  const [emailOtpSent, setEmailOtpSent] = useState(false)
  const [maskedEmail, setMaskedEmail] = useState('')

  // SAML SSO state
  const [ssoEnabled, setSsoEnabled] = useState(false)

  useEffect(() => {
    if (!organizationId) return
    let cancelled = false
    fetch(`/api/auth/saml/status?organizationId=${encodeURIComponent(organizationId)}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json?.data?.enabled) {
          setSsoEnabled(true)
        }
      })
      .catch(() => { /* SSO status is non-critical */ })
    return () => { cancelled = true }
  }, [organizationId])

  // ── Hydrate localStorage after successful login ──
  function hydrateSession(data: {
    token?: string
    organizationId?: string
    // `gradeLevel` and `schoolType` are emitted as `null` by the login endpoint
    // post-Phase-1c — they're kept here for localStorage-bridge backward compat.
    organization?: { name?: string; logoUrl?: string; gradeLevel?: string | null; schoolType?: string | null; onboardingStatus?: string }
    user?: {
      name?: string
      email?: string
      avatar?: string
      team?: string
      teamSlugs?: string[]
      /** Grade-level division the user is pinned to. Null/empty = org-wide. */
      campusScope?: string
      /** User's home school ID for default school selection */
      schoolId?: string
      /** @deprecated Use campusScope — kept for backward-compat during Phase 1c migration. */
      schoolScope?: string
      role?: string
    }
  }) {
    localStorage.setItem('auth-token', data.token || 'cookie-auth')
    localStorage.setItem('org-id', data.organizationId || '')
    localStorage.setItem('user-name', data.user?.name || '')
    localStorage.setItem('user-email', data.user?.email || '')
    localStorage.setItem('user-avatar', data.user?.avatar || '')
    localStorage.setItem('user-team', data.user?.team || '')
    localStorage.setItem('user-team-slugs', JSON.stringify(data.user?.teamSlugs || []))
    const campusScopeValue = data.user?.campusScope ?? data.user?.schoolScope ?? ''
    localStorage.setItem('user-campus-scope', campusScopeValue)
    // Keep legacy key in sync during the migration window
    localStorage.setItem('user-school-scope', campusScopeValue)
    localStorage.setItem('user-school-id', data.user?.schoolId || '')
    localStorage.setItem('user-role', data.user?.role || '')
    localStorage.setItem('org-name', data.organization?.name || '')
    // `gradeLevel` and `schoolType` were removed from Organization in Phase 1c
    // (grade level is now per-Campus, institution type per-School). The login
    // endpoint emits both as `null` for backward compat, so this write is
    // effectively empty until consumers migrate to per-school reads.
    localStorage.setItem('org-school-type', data.organization?.schoolType || '')
    localStorage.setItem('org-logo-url', data.organization?.logoUrl || '')

    // F-010: dropped the redundant /api/modules prefetch here — the
    // AuthBridge in providers.tsx fetches modules and primes the TanStack
    // Query cache the moment the dashboard mounts, so doing it from the
    // login form just guaranteed two simultaneous fetches on first paint.

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
        setHasPasskeys(!!data.data.hasPasskeys)
        setHasTotp(data.data.hasTotp !== false) // default true for backward compat
        setMfaMode(true)
        setMfaCode('')
        setMfaError('')
        // Auto-focus the code input after render (only if TOTP is available)
        if (!data.data.hasPasskeys) {
          setTimeout(() => mfaInputRef.current?.focus(), 100)
        }
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

  // ── Passkey authentication ──
  async function handlePasskeyAuth() {
    setMfaError('')
    setPasskeyLoading(true)
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    try {
      // Step 1: Get authentication options from server
      const optionsRes = await fetch('/api/auth/passkey/authenticate/options', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfaToken }),
      })
      const optionsData = await optionsRes.json()

      if (!optionsData.ok) {
        if (optionsData.error?.code === 'INVALID_TOKEN') {
          setMfaMode(false)
          setMfaToken('')
          setError('Your verification session expired. Please sign in again.')
          return
        }
        setMfaError(optionsData.error?.message || 'Failed to start passkey verification')
        return
      }

      // Step 2: Trigger browser passkey prompt
      const passkeyOptions = {
        ...optionsData.data.options,
        timeout: PASSKEY_AUTH_TIMEOUT_MS,
      }
      const assertionPromise = startAuthentication({ optionsJSON: passkeyOptions })
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          WebAuthnAbortService.cancelCeremony()
          reject(new Error('Passkey verification timed out. Try again or use an email code.'))
        }, PASSKEY_AUTH_TIMEOUT_MS + 1000)
      })

      const assertion = await Promise.race([assertionPromise, timeoutPromise])

      // Step 3: Verify assertion with server
      const verifyRes = await fetch('/api/auth/passkey/authenticate/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mfaToken,
          credential: assertion,
          challengeId: optionsData.data.challengeId,
        }),
      })
      const verifyData = await verifyRes.json()

      if (!verifyData.ok) {
        setMfaError(verifyData.error?.message || 'Passkey verification failed')
        return
      }

      hydrateSession(verifyData.data)
    } catch (err) {
      // User cancelled the browser prompt or error occurred
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setMfaError('Passkey was not completed. Try again or use an email code.')
      } else {
        setMfaError(err instanceof Error ? err.message : 'Passkey verification failed')
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
      setPasskeyLoading(false)
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

  // ── Request email OTP ──
  async function handleRequestEmailCode() {
    if (passkeyLoading) {
      WebAuthnAbortService.cancelCeremony()
      setPasskeyLoading(false)
    }
    setEmailOtpSending(true)
    setMfaError('')
    try {
      const res = await fetch('/api/auth/mfa/email-code', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfaToken }),
      })
      const data = await res.json()
      if (!data.ok) {
        if (data.error?.code === 'INVALID_TOKEN') {
          setMfaMode(false)
          setMfaToken('')
          setError('Your verification session expired. Please sign in again.')
          return
        }
        setMfaError(data.error?.message || 'Could not send code. Try again.')
        return
      }
      setMaskedEmail(data.data.maskedEmail || '')
      setEmailOtpMode(true)
      setEmailOtpSent(true)
      setMfaCode('')
      setTimeout(() => mfaInputRef.current?.focus(), 100)
    } catch (err) {
      setMfaError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setEmailOtpSending(false)
    }
  }

  function handleBackToSignIn() {
    if (passkeyLoading) {
      WebAuthnAbortService.cancelCeremony()
      setPasskeyLoading(false)
    }
    setForgotMode(false)
    setForgotEmail('')
    setForgotSent(false)
    setMfaMode(false)
    setMfaToken('')
    setMfaCode('')
    setMfaError('')
    setEmailOtpMode(false)
    setEmailOtpSent(false)
    setMaskedEmail('')
  }

  // ── MFA code entry mode ──
  if (mfaMode) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-4">
            {emailOtpMode ? <Mail className="w-6 h-6 text-white" /> : <ShieldCheck className="w-6 h-6 text-white" />}
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">
            {emailOtpMode ? 'Check your email' : 'Two-factor authentication'}
          </h2>
          <p className="text-sm text-slate-500">
            {emailOtpMode
              ? `We sent a 6-digit code to ${maskedEmail}`
              : hasPasskeys && hasTotp
              ? 'Use your passkey or enter a code from your authenticator app.'
              : hasPasskeys
              ? 'Use your passkey to verify your identity.'
              : 'Enter the 6-digit code from your authenticator app, or use a backup code.'}
          </p>
        </div>

        {/* Passkey button — hide when in email OTP mode */}
        {hasPasskeys && !emailOtpMode && (
          <button
            type="button"
            onClick={handlePasskeyAuth}
            disabled={passkeyLoading}
            className="w-full flex items-center justify-center gap-2.5 rounded-full bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Fingerprint className="w-5 h-5" />
            {passkeyLoading ? 'Verifying...' : 'Use passkey'}
          </button>
        )}

        {/* Divider when both methods available */}
        {hasPasskeys && hasTotp && !emailOtpMode && (
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">or enter a code</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
        )}

        {/* Code input — shown for TOTP, backup codes, or email OTP */}
        {(hasTotp || emailOtpMode) && (
          <form onSubmit={handleMfaSubmit} className="space-y-4">
            <div>
              <label htmlFor="mfa-code" className="block text-sm font-medium text-slate-700 mb-1">
                {emailOtpMode ? 'Email verification code' : 'Verification code'}
              </label>
              <Input
                ref={mfaInputRef}
                id="mfa-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9A-Za-z-]/g, ''))}
                placeholder="000000"
                className="text-center text-lg font-mono tracking-[0.3em] placeholder:text-slate-300"
                required
                autoFocus={!hasPasskeys || emailOtpMode}
                maxLength={12}
              />
            </div>

            <button
              type="submit"
              disabled={mfaLoading || mfaCode.length < 6}
              className={`w-full rounded-full px-4 py-3.5 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                hasPasskeys && !emailOtpMode
                  ? 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              {mfaLoading ? 'Verifying...' : 'Verify code'}
            </button>
          </form>
        )}

        {mfaError && (
          <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {mfaError}
          </div>
        )}

        {/* Email me a code — fallback for users without TOTP or who can't use passkey */}
        {!emailOtpMode && (
          <button
            type="button"
            onClick={handleRequestEmailCode}
            disabled={emailOtpSending}
            className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <Mail className="w-4 h-4" />
            {emailOtpSending ? 'Sending...' : 'Email me a code instead'}
          </button>
        )}

        {/* Resend code — shown after email OTP was sent */}
        {emailOtpSent && emailOtpMode && (
          <button
            type="button"
            onClick={handleRequestEmailCode}
            disabled={emailOtpSending}
            className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
          >
            {emailOtpSending ? 'Sending...' : "Didn't get it? Resend code"}
          </button>
        )}

        <button
          type="button"
          onClick={handleBackToSignIn}
          className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
        >
          Back to sign in
        </button>
      </div>
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
          <Input
            id="forgot-email"
            name="email"
            type="email"
            value={forgotEmail}
            onChange={(e) => setForgotEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1"
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
    <div className="space-y-6">
      {ssoEnabled && (
        <>
          <a
            href={`/api/auth/saml/initiate?organizationId=${encodeURIComponent(organizationId)}${searchParams.get('redirect') ? `&redirect=${encodeURIComponent(searchParams.get('redirect')!)}` : ''}`}
            className="w-full flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-3.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 transition-colors cursor-pointer"
          >
            <KeyRound className="w-4 h-4" />
            Sign in with SSO
          </a>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-4 text-slate-400">or sign in with email</span>
            </div>
          </div>
        </>
      )}
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Email address
          </label>
          {/* F-046: name attribute lets password managers identify and autofill. */}
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1"
            hasError={!!error}
            required
            autoComplete="email"
            autoFocus
            aria-invalid={!!error}
            aria-describedby={error ? 'login-error' : undefined}
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
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="pr-12"
              hasError={!!error}
              required
              autoComplete="current-password"
              aria-invalid={!!error}
              aria-describedby={error ? 'login-error' : undefined}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div id="login-error" role="alert" className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
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
    </div>
  )
}
