'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'

function SetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !password.trim()) return
    setStatus('loading')
    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: password.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.success) setStatus('done')
      else setStatus('error')
    } catch {
      setStatus('error')
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-red-600">Invalid or missing setup link.</p>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-green-600">Password set. You can now sign in.</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Set your password</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          className="w-full rounded border border-zinc-300 px-3 py-2"
          minLength={8}
          required
        />
        <button type="submit" disabled={status === 'loading'} className="w-full rounded bg-zinc-900 px-3 py-2 text-white disabled:opacity-50">
          {status === 'loading' ? 'Setting…' : 'Set password'}
        </button>
        {status === 'error' && <p className="text-sm text-red-600">Something went wrong. Try again.</p>}
      </form>
    </div>
  )
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center p-4">Loading…</div>}>
      <SetPasswordForm />
    </Suspense>
  )
}
