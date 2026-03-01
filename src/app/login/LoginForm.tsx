'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, organizationId }),
      })

      const data = await res.json()

      if (!data.ok) {
        setError(data.error?.message || 'Login failed')
        return
      }

      // Store auth token and org ID for 30 days (matching JWT expiration)
      localStorage.setItem('auth-token', data.data.token)
      localStorage.setItem('org-id', data.data.organizationId)
      localStorage.setItem('user-name', data.data.user.name || 'User')
      localStorage.setItem('user-email', data.data.user.email)
      if (data.data.user.avatar) {
        localStorage.setItem('user-avatar', data.data.user.avatar)
      } else {
        localStorage.removeItem('user-avatar')
      }
      if (data.data.user.team) {
        localStorage.setItem('user-team', data.data.user.team)
      } else {
        localStorage.removeItem('user-team')
      }
      if (data.data.user.schoolScope) {
        localStorage.setItem('user-school-scope', data.data.user.schoolScope)
      } else {
        localStorage.removeItem('user-school-scope')
      }
      if (data.data.user.role) {
        localStorage.setItem('user-role', data.data.user.role)
      } else {
        localStorage.removeItem('user-role')
      }
      localStorage.setItem('org-name', data.data.organization?.name || organizationName)
      if (data.data.organization?.schoolType) {
        localStorage.setItem('org-school-type', data.data.organization.schoolType)
      } else {
        localStorage.removeItem('org-school-type')
      }
      const logo = data.data.organization?.logoUrl || organizationLogoUrl
      if (logo) {
        localStorage.setItem('org-logo-url', logo)
      } else {
        localStorage.removeItem('org-logo-url')
      }
      
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

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
            className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition-colors"
            required
            autoComplete="email"
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition-colors"
            required
            autoComplete="current-password"
          />
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
        className="w-full rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Signing in...' : `Sign in to ${organizationName}`}
      </button>

      <p className="text-center text-xs text-gray-500">
        By signing in, you&apos;ll stay logged in for 30 days
      </p>
    </form>
  )
}
