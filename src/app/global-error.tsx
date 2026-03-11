'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '16px', fontFamily: 'system-ui, sans-serif' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827' }}>Something went wrong</h2>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>An unexpected error occurred. Please try again.</p>
          <button
            onClick={reset}
            style={{ padding: '8px 20px', borderRadius: '9999px', backgroundColor: '#111827', color: 'white', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', border: 'none' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
