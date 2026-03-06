'use client'

import { Wifi, WifiOff, Loader2, Upload } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'

type IndicatorState = 'offline' | 'syncing' | 'queued' | 'online'

/**
 * Always-visible connectivity indicator shown in the dashboard header.
 *
 * States (in priority order):
 *   offline  — no network connection (amber pill)
 *   syncing  — online + actively syncing queued mutations (blue pill)
 *   queued   — online + pending mutations waiting for manual sync (orange pill)
 *   online   — connected with nothing pending (minimal green dot)
 */
export default function ConnectivityIndicator() {
  const { isOnline, queueCount, isSyncing, triggerSync } = useOfflineQueue()

  // Determine display state with priority: offline > syncing > queued > online
  let state: IndicatorState = 'online'
  if (!isOnline) state = 'offline'
  else if (isSyncing) state = 'syncing'
  else if (queueCount > 0) state = 'queued'

  const stateKey = state

  return (
    <AnimatePresence mode="wait">
      {state === 'online' ? (
        <motion.span
          key="online"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          className="flex items-center justify-center"
          aria-label="Online"
          title="Connected"
        >
          <Wifi className="w-4 h-4 text-emerald-400" />
        </motion.span>
      ) : (
        <motion.span
          key={stateKey}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            state === 'offline'
              ? 'bg-amber-100 text-amber-700'
              : state === 'syncing'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-orange-100 text-orange-700 cursor-pointer hover:bg-orange-200 transition-colors'
          }`}
          onClick={state === 'queued' ? () => triggerSync() : undefined}
          role={state === 'queued' ? 'button' : undefined}
          aria-label={
            state === 'offline'
              ? 'Offline — changes will sync when reconnected'
              : state === 'syncing'
                ? 'Syncing queued changes...'
                : `${queueCount} change${queueCount === 1 ? '' : 's'} queued — click to sync`
          }
          title={
            state === 'offline'
              ? 'Offline'
              : state === 'syncing'
                ? 'Syncing...'
                : `${queueCount} queued — click to sync`
          }
        >
          {state === 'offline' && <WifiOff className="w-3.5 h-3.5" />}
          {state === 'syncing' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {state === 'queued' && <Upload className="w-3.5 h-3.5" />}
          <span>
            {state === 'offline' && 'Offline'}
            {state === 'syncing' && 'Syncing...'}
            {state === 'queued' && `${queueCount} queued`}
          </span>
        </motion.span>
      )}
    </AnimatePresence>
  )
}
