'use client'

import { useEffect } from 'react'
import { logger } from '@/lib/logger'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        logger.error({ error: String(err) }, 'Service worker registration failed')
      })
    }
  }, [])

  return null
}
