'use client'

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

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

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
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

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Set Password</h1>

        {loading ? (
          <p className="text-sm text-gray-600">Validating setup link...</p>
        ) : !valid ? (
          <p className="text-sm text-red-600">{error || 'This setup link is invalid.'}</p>
        ) : success ? (
          <div className="space-y-2">
            <p className="text-sm text-green-700">Password set successfully.</p>
            {userStatus !== 'ACTIVE' && (
              <p className="text-sm text-amber-700">Your account is pending approval. An admin must activate it before login.</p>
            )}
            <p className="text-sm text-gray-600">Redirecting to login...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-gray-600">Setting password for {email}</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? 'Saving...' : 'Set Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center p-4"><p className="text-sm text-gray-600">Loading...</p></div>}>
      <SetPasswordContent />
    </Suspense>
  )
}
