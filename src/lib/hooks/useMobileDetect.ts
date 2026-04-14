'use client'

import { useState, useEffect, useMemo } from 'react'

type Platform = 'ios' | 'android' | 'desktop' | 'unknown'

interface MobileDetectResult {
  /** True when viewport is below the lg breakpoint (1024px) — matches sidebar lg:hidden/lg:flex split */
  isMobile: boolean
  /** True when running as an installed PWA (standalone display mode) */
  isStandalone: boolean
  /** Detected platform based on user agent */
  platform: Platform
}

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'ios'
  }
  if (/Android/.test(ua)) return 'android'
  if (/Win|Mac|Linux/.test(ua) && navigator.maxTouchPoints === 0) return 'desktop'
  return 'unknown'
}

/**
 * Unified mobile detection hook. Combines viewport breakpoint, PWA standalone
 * mode detection, and platform identification into a single hook to avoid
 * duplicate matchMedia listeners.
 *
 * Uses the 1024px (lg) breakpoint to match the existing sidebar responsive split.
 */
export function useMobileDetect(): MobileDetectResult {
  // Initialize from matchMedia synchronously to avoid a wasted render cycle.
  // On the server this returns false; on the client the initializer reads
  // the real value so the very first paint is correct (no flash).
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(max-width: 1023px)').matches
  })
  const [isStandalone, setIsStandalone] = useState(() => {
    if (typeof window === 'undefined') return false
    const mq = window.matchMedia('(display-mode: standalone)').matches
    const ios = 'standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true
    return mq || ios
  })

  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 1023px)')
    const standaloneQuery = window.matchMedia('(display-mode: standalone)')

    const updateMobile = () => setIsMobile(mobileQuery.matches)
    const updateStandalone = () => {
      const ios = 'standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true
      setIsStandalone(standaloneQuery.matches || ios)
    }

    mobileQuery.addEventListener('change', updateMobile)
    standaloneQuery.addEventListener('change', updateStandalone)

    return () => {
      mobileQuery.removeEventListener('change', updateMobile)
      standaloneQuery.removeEventListener('change', updateStandalone)
    }
  }, [])

  const platform = useMemo(() => detectPlatform(), [])

  return { isMobile, isStandalone, platform }
}
