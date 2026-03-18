'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
        <AlertTriangle className="w-6 h-6 text-red-600" />
      </div>
      <h2 className="text-lg font-semibold text-slate-900 mb-2">Dashboard failed to load</h2>
      <p className="text-sm text-slate-500 mb-6 max-w-md">
        Something went wrong loading the dashboard. Please try again.
      </p>
      <button
        onClick={reset}
        className="ui-btn-md ui-btn-primary"
      >
        Try again
      </button>
    </div>
  )
}
