'use client'

import { useEffect } from 'react'
// NOTE: Do not import `logger` here — this is a client component and pino
// (used by logger in production) cannot load in the browser. Use console
// directly for the single error path below.

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // In development, proactively unregister any previously-installed SW and
    // clear caches. A stale production SW from an earlier visit intercepts
    // CSS/JS fetches and serves old bundles, which manifests as things like
    // "text on a button is missing" — invisible until the user hard-reloads.
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .then(() => {
          if ('caches' in window) {
            return caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
          }
        })
        .catch(() => { /* best-effort cleanup */ })
      return
    }

    navigator.serviceWorker.register('/sw.js').catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Service worker registration failed:', err)
    })
  }, [])

  return null
}
