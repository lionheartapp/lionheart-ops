'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { logger } from '@/lib/logger'

export default function AthleticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Athletics page error')
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
        <AlertTriangle className="w-6 h-6 text-red-600" />
      </div>
      <h2 className="text-lg font-semibold text-slate-900 mb-2">Failed to load</h2>
      <p className="text-sm text-slate-500 mb-6 max-w-md">
        Something went wrong. Please try again.
      </p>
      <button
        onClick={reset}
        className="px-6 py-2.5 bg-gray-900 text-white rounded-full text-sm font-medium hover:bg-gray-800 transition-colors cursor-pointer"
      >
        Try again
      </button>
    </div>
  )
}
