'use client'

import { useState, useEffect } from 'react'
import { getSubdomain } from '../utils/subdomain'
import { setCurrentOrgId } from '../services/platformApi'

const PLATFORM_URL = typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_PLATFORM_URL?.trim()
  ? process.env.NEXT_PUBLIC_PLATFORM_URL.trim()
  : ''

/**
 * When the app is loaded on a school subdomain (e.g. linfieldchristianschool.lionheartapp.com),
 * fetches org by subdomain and sets it as the current org for API calls, then renders children.
 * Without this, x-org-id would be missing or wrong for subdomain visits.
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
    const url = `${PLATFORM_URL}/api/public/org-branding?subdomain=${encodeURIComponent(sub)}`
    fetch(url)
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
