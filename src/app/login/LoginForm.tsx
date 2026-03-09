'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'

interface LoginFormProps {
  organizationId: string
  organizationName: string
  organizationLogoUrl?: string
}

export default function LoginForm({ organizationId, organizationName, organizationLogoUrl }: LoginFormProps) {
  const router = useRouter()
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include', // Required so browser stores the Set-Cookie response
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, organizationId }),
      })

      const data = await res.json()

      if (!data.ok) {
        setError(data.error?.message || 'Login failed')
        return
      }

      // Auth token is now stored in an httpOnly cookie by the server.
      // No localStorage writes needed — redirect directly to dashboard.
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotSubmit(e: FormEvent) {
    e.preventDefault()
    setForgotLoading(true)

    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, organizationId }),
      })
      // Always show success message regardless of response to prevent email enumeration
      setForgotSent(true)
    } catch {
      // Still show success to prevent enumeration
      setForgotSent(true)
    } finally {
      setForgotLoading(false)
    }
  }

  function handleBackToSignIn() {
    setForgotMode(false)
    setForgotEmail('')
    setForgotSent(false)
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
            className="w-full text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Back to sign in
          </button>
        </div>
      )
    }

    return (
      <form onSubmit={handleForgotSubmit} className="space-y-6">
        <div>
          <p className="text-sm text-gray-600 mb-4">
            Enter your email address and we&apos;ll send you a link to reset your password.
          </p>
          <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700">
            Email address
          </label>
          <input
            id="forgot-email"
            type="email"
            value={forgotEmail}
            onChange={(e) => setForgotEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus-visible:ring-1 focus-visible:ring-gray-900/10 transition-colors"
            required
            autoComplete="email"
            autoFocus
          />
        </div>

        <button
          type="submit"
          disabled={forgotLoading}
          className="w-full rounded-full bg-gray-900 px-4 py-3.5 text-sm font-semibold text-white hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {forgotLoading ? 'Sending...' : 'Send reset link'}
        </button>

        <button
          type="button"
          onClick={handleBackToSignIn}
          className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
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
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus-visible:ring-1 focus-visible:ring-gray-900/10 transition-colors"
            required
            autoComplete="email"
            autoFocus
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <button
              type="button"
              onClick={() => {
                setForgotEmail(email)
                setForgotMode(true)
              }}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
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
              className="block w-full rounded-lg border border-gray-300 px-4 py-3 pr-12 text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus-visible:ring-1 focus-visible:ring-gray-900/10 transition-colors"
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <p className="font-medium">Sign in failed</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-gray-900 px-4 py-3.5 text-sm font-semibold text-white hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Signing in...' : `Sign in to ${organizationName}`}
      </button>

      <p className="text-center text-xs text-gray-500">
        By signing in, you&apos;ll stay logged in for 30 days
      </p>
    </form>
  )
}
