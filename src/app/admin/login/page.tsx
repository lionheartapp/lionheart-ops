'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Mail, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/Input'

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
    <div className="min-h-screen flex items-center justify-center bg-[#0B1120] px-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary-500/[0.07] rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <img src="/logo-white.svg" alt="Lionheart" className="h-10 w-auto mx-auto mb-5" />
          <p className="text-slate-400 mt-1 text-sm">{isSetup ? 'Create your admin account' : 'Platform administration'}</p>
        </div>

        <div className="bg-[#0F1629] border border-white/[0.06] rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            {isSetup && (
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Name</label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-500 focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20 text-sm"
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-500 focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20 text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSetup ? 'Min 8 characters' : 'Enter your password'}
                  className="w-full pl-10 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-500 focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20 text-sm"
                  required
                  minLength={isSetup ? 8 : undefined}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-primary-500 to-indigo-500 hover:from-primary-600 hover:to-indigo-600 text-white font-medium transition-all disabled:opacity-50 shadow-lg shadow-primary-500/20"
            >
              {loading ? 'Please wait...' : isSetup ? 'Create Admin Account' : 'Sign In'}
            </button>
          </form>
        </div>

        <button
          onClick={() => { setIsSetup(!isSetup); setError('') }}
          className="w-full text-center mt-4 text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          {isSetup ? 'Already have an account? Sign in' : 'First time? Set up admin account'}
        </button>
      </div>
    </div>
  )
}
