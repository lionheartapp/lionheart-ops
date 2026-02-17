'use client'

import { useState, useEffect } from 'react'
import { getSubdomain } from '../utils/subdomain'
import { setCurrentOrgId } from '../services/platformApi'

/**
 * When the app is loaded on a school subdomain, fetches org by subdomain and sets current org for API calls.
 */
export function SubdomainResolver({ children }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const sub = getSubdomain()
    if (!sub) {
      setReady(true)
      return
    }
    fetch(`/api/public/org-branding?subdomain=${encodeURIComponent(sub)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.found && data?.id) {
          setCurrentOrgId(data.id)
          setReady(true)
        } else {
          setError('School not found')
        }
      })
      .catch(() => setError('Could not load school'))
  }, [])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <p className="text-zinc-600 dark:text-zinc-400">{error}</p>
      </div>
    )
  }
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <p className="text-zinc-500">Loading…</p>
      </div>
    )
  }
  return children
}
