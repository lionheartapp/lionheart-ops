'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, AlertCircle, RefreshCw, X } from 'lucide-react'
import type { SyncResult } from '@/lib/offline/sync'

interface OfflineSyncStatusProps {
  result: SyncResult | null
  onDismiss: () => void
  onRetry: () => void
}

/**
 * Small panel showing the result of a background sync operation.
 *
 * Auto-dismisses after 5 seconds if there are no failures.
 * If there are failures, stays visible and shows a Retry button.
 */
export default function OfflineSyncStatus({
  result,
  onDismiss,
  onRetry,
}: OfflineSyncStatusProps) {
  const visible = result !== null

  // Auto-dismiss after 5 seconds when fully successful
  useEffect(() => {
    if (!result || result.failed > 0) return
    const timer = setTimeout(onDismiss, 5000)
    return () => clearTimeout(timer)
  }, [result, onDismiss])

  if (!result) return null

  const isSuccess = result.failed === 0
  const hasPartial = result.succeeded > 0 && result.failed > 0

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="ui-glass-dropdown absolute right-0 top-full mt-2 w-72 p-4 z-dropdown"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            {isSuccess ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">
                {isSuccess
                  ? `Synced ${result.succeeded} change${result.succeeded === 1 ? '' : 's'} successfully`
                  : hasPartial
                    ? `${result.succeeded} synced, ${result.failed} failed`
                    : `${result.failed} change${result.failed === 1 ? '' : 's'} failed to sync`}
              </p>
              {result.errors.length > 0 && (
                <p className="text-xs text-red-600 mt-1 truncate" title={result.errors[0]}>
                  {result.errors[0]}
                </p>
              )}
              {result.failed > 0 && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-2 flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  Retry failed
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={onDismiss}
              className="p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer flex-shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
