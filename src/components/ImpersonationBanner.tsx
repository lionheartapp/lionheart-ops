'use client'

import { useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'

export default function ImpersonationBanner() {
  const [returning, setReturning] = useState(false)

  const userName = typeof window !== 'undefined' ? localStorage.getItem('user-name') : ''
  const userRole = typeof window !== 'undefined' ? localStorage.getItem('user-role') : ''
  const userTeam = typeof window !== 'undefined' ? localStorage.getItem('user-team') : ''
  const adminName = typeof window !== 'undefined' ? localStorage.getItem('admin-name') : ''

  const handleReturn = async () => {
    setReturning(true)
    try {
      // Read CSRF token from cookie
      const csrfMatch = document.cookie
        .split(';')
        .find((c) => c.trim().startsWith('csrf-token='))
      const csrfToken = csrfMatch
        ? csrfMatch.trim().slice('csrf-token='.length)
        : null

      const headers: Record<string, string> = {}
      if (csrfToken) headers['X-CSRF-Token'] = csrfToken

      const res = await fetch('/api/auth/impersonate', {
        method: 'DELETE',
        credentials: 'include',
        headers,
      })

      if (!res.ok) {
        throw new Error('Failed to end impersonation')
      }

      // Clear impersonation state and reload to re-hydrate as admin
      localStorage.removeItem('is-impersonating')
      localStorage.removeItem('admin-name')
      window.location.reload()
    } catch {
      setReturning(false)
      alert('Failed to end impersonation. Please try again.')
    }
  }

  const parts = [userName, userRole].filter(Boolean)
  if (userTeam) parts.push(userTeam)

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-3 px-4 py-2 text-sm font-medium text-white"
      style={{
        background: 'linear-gradient(90deg, #3B82F6 0%, #6366F1 50%, #8B5CF6 100%)',
      }}
    >
      <ArrowLeftRight className="w-4 h-4 flex-shrink-0" />
      <span>
        Viewing as <strong>{userName || 'User'}</strong>
        {userRole && <span className="opacity-80"> ({userRole})</span>}
        {userTeam && <span className="opacity-80"> &mdash; {userTeam}</span>}
      </span>
      <button
        onClick={handleReturn}
        disabled={returning}
        className="ml-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
      >
        {returning ? 'Returning...' : `Return to ${adminName || 'your account'}`}
      </button>
    </div>
  )
}
