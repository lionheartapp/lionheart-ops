'use client'

import { useState, useEffect } from 'react'
import { fetchApi } from '@/lib/api-client'

/**
 * Resolves the organization logo URL. Prefers the value from useAuth,
 * falls back to fetching from /api/onboarding/school-info if not present.
 *
 * Usage:
 *   const { user, org, isReady } = useAuth(...)
 *   const orgLogoUrl = useOrgLogo(org.logoUrl, isReady)
 */
export function useOrgLogo(
  authLogoUrl: string | null | undefined,
  isReady: boolean,
): string | null {
  const [logoUrl, setLogoUrl] = useState<string | null>(authLogoUrl ?? null)

  // Sync when useAuth refreshes the value
  useEffect(() => {
    if (authLogoUrl && authLogoUrl !== logoUrl) {
      setLogoUrl(authLogoUrl)
    }
  }, [authLogoUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch if not already present
  useEffect(() => {
    if (logoUrl || !isReady) return
    let cancelled = false
    fetchApi<{ logoUrl?: string | null }>('/api/onboarding/school-info')
      .then((data) => {
        if (!cancelled && data?.logoUrl) {
          setLogoUrl(data.logoUrl)
        }
      })
      .catch(() => {
        // Non-critical — silently ignore
      })
    return () => {
      cancelled = true
    }
  }, [logoUrl, isReady])

  return logoUrl
}
