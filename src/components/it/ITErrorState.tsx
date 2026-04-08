'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ITErrorStateProps {
  message?: string
  onRetry?: () => void
  compact?: boolean
}

export default function ITErrorState({
  message = 'Unable to load data',
  onRetry,
  compact = false,
}: ITErrorStateProps) {
  if (compact) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-8 px-4">
        <AlertTriangle className="w-6 h-6 text-red-400 mb-2" />
        <p className="text-sm font-medium text-slate-600 mb-1">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="ui-glass rounded-2xl p-10 flex flex-col items-center justify-center text-center">
      <AlertTriangle className="w-8 h-8 text-red-400 mb-3" />
      <p className="text-sm font-medium text-slate-600 mb-1">{message}</p>
      <p className="text-xs text-slate-400 mb-4">Check your connection and try again.</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      )}
    </div>
  )
}
