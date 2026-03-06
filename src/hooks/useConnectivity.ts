'use client'

import { useState, useEffect } from 'react'

/**
 * Hook to track online/offline connectivity status.
 *
 * Returns true when the browser has network access, false when offline.
 * Responds to the browser's 'online' and 'offline' window events in real time.
 */
export function useConnectivity(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(
    () => (typeof navigator !== 'undefined' ? navigator.onLine : true)
  )

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}
