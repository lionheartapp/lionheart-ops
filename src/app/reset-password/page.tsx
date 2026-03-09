'use client'

import { FormEvent, Suspense, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import PasswordInput from '@/components/PasswordInput'
import { validatePassword } from '@/lib/validation/password'

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-4 text-sm text-red-700">
          <p className="font-medium">Invalid or missing reset link</p>
          <p className="mt-1">This link is not valid. Please request a new password reset.</p>
        </div>
        <a
          href="/login"
          className="inline-block text-sm text-gray-600 hover:text-gray-900 transition-colors underline"
        >
          Back to sign in
        </a>
      </div>
    )
  }

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
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        credentials: 'include', // Required so browser stores the Set-Cookie response
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = await res.json()

      if (!data.ok) {
        const code = data.error?.code
        if (code === 'TOKEN_EXPIRED') {
          setError('This reset link has expired. Please request a new one.')
        } else if (code === 'TOKEN_USED') {
          setError('This reset link has already been used. Please request a new one.')
        } else if (code === 'INVALID_TOKEN') {
          setError('This reset link is not valid. Please request a new one.')
        } else {
          setError(data.error?.message || 'Failed to reset password. Please try again.')
        }
        return
      }

      // Auth token is now stored in an httpOnly cookie by the server.
      // No localStorage writes needed — redirect directly to dashboard.
      setSuccess(true)
      setTimeout(() => router.push('/dashboard'), 1500)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-4 text-sm text-green-800">
          <p className="font-medium">Password reset successfully</p>
          <p className="mt-1">You are being signed in and redirected to your dashboard&hellip;</p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <PasswordInput
          value={password}
          onChange={setPassword}
          label="New password"
          placeholder="At least 8 characters"
          id="rp-password"
          required
          autoComplete="new-password"
        />

        <div>
          <label htmlFor="rp-confirm" className="block text-sm font-medium text-gray-700">
            Confirm new password
          </label>
          <div className="relative mt-1">
            <input
              id="rp-confirm"
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your new password"
              className="block w-full rounded-lg border border-gray-300 px-4 py-3 pr-12 text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus-visible:ring-1 focus-visible:ring-gray-900/10 transition-colors"
              required
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <p className="font-medium">Reset failed</p>
          <p className="mt-1">{error}</p>
          {(error.includes('expired') || error.includes('already been used') || error.includes('not valid')) && (
            <a
              href="/login"
              className="inline-block mt-2 text-red-700 underline hover:text-red-900 transition-colors"
            >
              Request a new reset link
            </a>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full bg-gray-900 px-4 py-3.5 text-sm font-semibold text-white hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? 'Resetting password...' : 'Set new password'}
      </button>

      <p className="text-center text-sm">
        <a
          href="/login"
          className="text-gray-500 hover:text-gray-700 transition-colors"
        >
          Back to sign in
        </a>
      </p>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-950 to-zinc-900 px-4">
      <div className="w-full max-w-md">
        {/* Lionheart logo */}
        <div className="text-center mb-8">
          <img src="/logo-white.svg" alt="Lionheart" className="h-10 w-auto mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-white">Reset your password</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Enter a new password for your account
          </p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-xl">
          <Suspense fallback={
            <div className="text-center py-4">
              <p className="text-sm text-gray-600">Loading&hellip;</p>
            </div>
          }>
            <ResetPasswordContent />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
