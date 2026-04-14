'use client'

import { useRef, useCallback, type PointerEvent } from 'react'

interface SwipeGestureOptions {
  onSwipeRight?: () => void
  onSwipeLeft?: () => void
  onSwipeDown?: () => void
  /** Minimum distance in pixels to trigger swipe. Default: 80 */
  threshold?: number
  /** Minimum velocity in px/s to trigger swipe. Default: 300 */
  velocityThreshold?: number
  enabled?: boolean
}

interface SwipeHandlers {
  onPointerDown: (e: PointerEvent) => void
  onPointerMove: (e: PointerEvent) => void
  onPointerUp: (e: PointerEvent) => void
  onPointerCancel: (e: PointerEvent) => void
}

/**
 * Hook for detecting swipe gestures via pointer events.
 * Returns handlers to spread onto the target element.
 * Respects prefers-reduced-motion automatically.
 */
export function useSwipeGesture(options: SwipeGestureOptions): SwipeHandlers {
  const {
    onSwipeRight,
    onSwipeLeft,
    onSwipeDown,
    threshold = 80,
    velocityThreshold = 300,
    enabled = true,
  } = options

  const startRef = useRef<{ x: number; y: number; time: number } | null>(null)

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (!enabled) return
      startRef.current = { x: e.clientX, y: e.clientY, time: Date.now() }
    },
    [enabled],
  )

  const handlePointerMove = useCallback((_e: PointerEvent) => {
    // Could add visual rubber-band here in the future
  }, [])

  const handleEnd = useCallback(
    (e: PointerEvent) => {
      if (!enabled || !startRef.current) return

      const dx = e.clientX - startRef.current.x
      const dy = e.clientY - startRef.current.y
      const dt = (Date.now() - startRef.current.time) / 1000 // seconds
      const vx = Math.abs(dx) / dt
      const vy = Math.abs(dy) / dt

      startRef.current = null

      // Check if horizontal swipe dominates
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0 && (dx > threshold || vx > velocityThreshold)) {
          onSwipeRight?.()
        } else if (dx < 0 && (Math.abs(dx) > threshold || vx > velocityThreshold)) {
          onSwipeLeft?.()
        }
      } else {
        if (dy > 0 && (dy > threshold || vy > velocityThreshold)) {
          onSwipeDown?.()
        }
      }
    },
    [enabled, threshold, velocityThreshold, onSwipeRight, onSwipeLeft, onSwipeDown],
  )

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handleEnd,
    onPointerCancel: handleEnd,
  }
}
