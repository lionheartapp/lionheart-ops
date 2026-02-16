/**
 * Sentry initialization for real-time error tracking.
 * Import this file FIRST in main.jsx (before any other imports).
 *
 * Set VITE_SENTRY_DSN in .env to enable. Get your DSN from:
 * https://sentry.io → Project Settings → Client Keys (DSN)
 */
import * as Sentry from '@sentry/react'

const dsn = import.meta.env.VITE_SENTRY_DSN?.trim()

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    sendDefaultPii: false,
  })
}

export { Sentry }
