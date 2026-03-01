'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Mail, AlertCircle } from 'lucide-react'

export default function PlatformLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSetup, setIsSetup] = useState(false)
  const [name, setName] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const endpoint = isSetup ? '/api/platform/auth/setup' : '/api/platform/auth/login'
      const body = isSetup ? { email, password, name } : { email, password }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!data.ok) {
        setError(data.error?.message || 'Login failed')
        setLoading(false)
        return
      }

      localStorage.setItem('platform-token', data.data.token)
      localStorage.setItem('platform-admin', JSON.stringify(data.data.admin))
      router.push('/admin/dashboard')
    } catch {
      setError('Connection failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary-500 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">L</div>
          <h1 className="text-2xl font-bold text-zinc-100">Lionheart Admin</h1>
          <p className="text-zinc-500 mt-1">{isSetup ? 'Create your admin account' : 'Platform administration'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {isSetup && (
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="ui-input-bordered"
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@lionheartapp.com"
                className="ui-input-bordered pl-10"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSetup ? 'Min 8 characters' : 'Enter your password'}
                className="ui-input-bordered pl-10"
                required
                minLength={isSetup ? 8 : undefined}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Please wait...' : isSetup ? 'Create Admin Account' : 'Sign In'}
          </button>
        </form>

        <button
          onClick={() => { setIsSetup(!isSetup); setError('') }}
          className="w-full text-center mt-4 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {isSetup ? 'Already have an account? Sign in' : 'First time? Set up admin account'}
        </button>
      </div>
    </div>
  )
}
