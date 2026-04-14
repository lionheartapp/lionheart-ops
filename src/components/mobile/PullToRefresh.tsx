'use client'

import { useState, useRef, useCallback, type ReactNode, type PointerEvent } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { haptic } from '@/lib/haptics'

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: ReactNode
  disabled?: boolean
}

const THRESHOLD = 60 // px to trigger refresh
const MAX_PULL = 100 // max visual pull distance

export default function PullToRefresh({
  onRefresh,
  children,
  disabled = false,
}: PullToRefreshProps) {
  const [refreshing, setRefreshing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const startY = useRef<number | null>(null)
  const pullY = useMotionValue(0)

  // Transform pull distance to spinner opacity and rotation
  const spinnerOpacity = useTransform(pullY, [0, THRESHOLD * 0.5, THRESHOLD], [0, 0.5, 1])
  const spinnerScale = useTransform(pullY, [0, THRESHOLD], [0.6, 1])

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (disabled || refreshing) return
      const el = containerRef.current
      if (!el || el.scrollTop > 0) return
      startY.current = e.clientY
    },
    [disabled, refreshing],
  )

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (startY.current === null || disabled || refreshing) return
      const el = containerRef.current
      if (!el || el.scrollTop > 0) {
        startY.current = null
        pullY.set(0)
        return
      }

      const dy = e.clientY - startY.current
      if (dy < 0) return // only pull down

      // Rubber-band effect — diminishing returns past threshold
      const pull = Math.min(dy * 0.5, MAX_PULL)
      pullY.set(pull)
    },
    [disabled, refreshing, pullY],
  )

  const handlePointerEnd = useCallback(async () => {
    if (startY.current === null) return
    const currentPull = pullY.get()
    startY.current = null

    if (currentPull >= THRESHOLD && !refreshing && !disabled) {
      haptic('light')
      setRefreshing(true)
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
        pullY.set(0)
      }
    } else {
      pullY.set(0)
    }
  }, [pullY, refreshing, disabled, onRefresh])

  return (
    <div
      ref={containerRef}
      className="relative flex-1 min-h-0 overflow-y-auto"
      style={{
        overscrollBehaviorY: 'contain',
        WebkitOverflowScrolling: 'touch',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      {/* Pull indicator */}
      <motion.div
        className="flex items-center justify-center h-0 overflow-visible"
        style={{ opacity: spinnerOpacity }}
      >
        <motion.div
          className="flex items-center justify-center w-8 h-8 rounded-full"
          style={{
            scale: spinnerScale,
            background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
            marginTop: 12,
          }}
        >
          <svg
            className={`w-4 h-4 text-white ${refreshing ? 'animate-spin' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              d="M4 12a8 8 0 0114.93-4M20 12a8 8 0 01-14.93 4"
            />
            {!refreshing && (
              <>
                <path stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" d="M20 4v4h-4" />
                <path stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" d="M4 20v-4h4" />
              </>
            )}
          </svg>
        </motion.div>
      </motion.div>

      {children}
    </div>
  )
}
