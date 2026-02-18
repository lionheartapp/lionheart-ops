'use client'

import { useState, useEffect } from 'react'
import { getSubdomain } from '../utils/subdomain'
import { setCurrentOrgId } from '../services/platformApi'

const PLATFORM_URL = typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_PLATFORM_URL?.trim()
  ? process.env.NEXT_PUBLIC_PLATFORM_URL.trim()
  : ''

const CACHE_KEY_PREFIX = 'lionheart-org-branding-'
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

function getCachedOrgId(subdomain) {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY_PREFIX + subdomain)
    if (!raw) return null
    const { id, at } = JSON.parse(raw)
    if (!id || !at || Date.now() - at > CACHE_TTL_MS) return null
    return id
  } catch {
    return null
  }
}

function setCachedOrgId(subdomain, id) {
  try {
    sessionStorage.setItem(CACHE_KEY_PREFIX + subdomain, JSON.stringify({ id, at: Date.now() }))
  } catch {}
}

/**
 * When the app is loaded on a school subdomain (e.g. linfieldchristianschool.lionheartapp.com),
 * fetches org by subdomain and sets it as the current org for API calls, then renders children.
 * Caches result in sessionStorage so repeat loads are instant.
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
    const cachedId = getCachedOrgId(sub)
    if (cachedId) {
      setCurrentOrgId(cachedId)
      setReady(true)
      return
    }
    const url = `${PLATFORM_URL}/api/public/org-branding?subdomain=${encodeURIComponent(sub)}`
    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.found && data?.id) {
          setCurrentOrgId(data.id)
          setCachedOrgId(sub, data.id)
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
