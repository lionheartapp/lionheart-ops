'use client'

import { useState } from 'react'

type Props = {
  organizationId: string
  organizationName: string
  organizationLogoUrl?: string
}

export default function LoginForm({ organizationId, organizationName, organizationLogoUrl }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
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
      if (!res.ok) {
        setError(data?.message || 'Login failed')
        return
      }
      if (data?.data?.token) {
        window.location.href = '/dashboard'
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {organizationLogoUrl && (
        <img src={organizationLogoUrl} alt={organizationName} className="mx-auto h-12 object-contain" />
      )}
      <h2 className="text-center text-lg font-semibold">{organizationName}</h2>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="w-full rounded border border-zinc-300 px-3 py-2"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="w-full rounded border border-zinc-300 px-3 py-2"
        required
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className="w-full rounded bg-zinc-900 py-2 text-white disabled:opacity-50">
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
