'use client'

import { useState, useLayoutEffect, useRef, useCallback, type RefCallback } from 'react'
import { useMotionValue, animate as fmAnimate, type MotionValue } from 'framer-motion'

// Module-level position memory keyed by persistence key.
// Survives component remounts (DashboardLayout is in page.tsx, so Sidebar remounts on navigation).
const _positionMemory = new Map<string, { top: number; height: number }>()
const _measuredKeys = new Set<string>()

export interface NavIndicatorValues {
  /** Callback ref for the container div wrapping the child links */
  containerRefCb: RefCallback<HTMLDivElement>
  /** Callback ref for the glow trail div */
  trailRefCb: (node: HTMLDivElement | null) => void
  /** Framer Motion value for indicator top position */
  indicatorTop: MotionValue<number>
  /** Framer Motion value for indicator height */
  indicatorHeight: MotionValue<number>
  /** Framer Motion value for indicator opacity */
  indicatorOpacity: MotionValue<number>
}

/**
 * Generalized animated gradient nav indicator.
 *
 * @param persistenceKey - Unique key for module-level position memory (e.g. 'facility', 'it')
 * @param isOpen - Whether the collapsible section is expanded
 * @param activeDataAttr - data attribute to find the active element (e.g. 'data-facility-active')
 * @param deps - Additional dependencies that should trigger re-measurement (e.g. pathname, permissions)
 */
export function useNavIndicator(
  persistenceKey: string,
  isOpen: boolean,
  activeDataAttr: string,
  deps: readonly unknown[] = [],
): NavIndicatorValues {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const trailRef = useRef<HTMLDivElement | null>(null)
  const [containerMounted, setContainerMounted] = useState(false)

  const indicatorTop = useMotionValue(0)
  const indicatorHeight = useMotionValue(0)
  const indicatorOpacity = useMotionValue(0)

  const trailRefCb = useCallback((node: HTMLDivElement | null) => {
    if (node && node.offsetParent === null) return
    trailRef.current = node
    if (node) node.style.opacity = '0'
  }, [])

  const containerRefCb: RefCallback<HTMLDivElement> = useCallback((node) => {
    if (node && node.offsetParent === null) return
    containerRef.current = node
    setContainerMounted(!!node)
  }, [])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    if (!isOpen) {
      indicatorOpacity.jump(0)
      return
    }

    const alreadyMeasured = _measuredKeys.has(persistenceKey)

    const positionIndicator = (shouldAnimate: boolean): boolean => {
      if (!container) return false

      const activeEl = container.querySelector(`[${activeDataAttr}="true"]`) as HTMLElement | null
      if (!activeEl) {
        indicatorOpacity.jump(0)
        _positionMemory.delete(persistenceKey)
        return true
      }

      const height = activeEl.offsetHeight
      if (height < 1) return false

      let top = 0
      let walker: HTMLElement | null = activeEl
      while (walker && walker !== container) {
        top += walker.offsetTop
        walker = walker.offsetParent as HTMLElement | null
      }

      const prev = _positionMemory.get(persistenceKey)
      const easing = [0.22, 1, 0.36, 1] as [number, number, number, number]

      if (prev && prev.top === top && prev.height === height) {
        indicatorOpacity.jump(1)
        return true
      }

      if (!shouldAnimate || !prev) {
        indicatorTop.jump(top)
        indicatorHeight.jump(height)
        indicatorOpacity.jump(1)
      } else {
        indicatorTop.jump(prev.top)
        indicatorHeight.jump(prev.height)
        indicatorOpacity.jump(1)

        fmAnimate(indicatorTop, top, { duration: 0.4, ease: easing })
        fmAnimate(indicatorHeight, height, { duration: 0.4, ease: easing })

        const trail = trailRef.current
        if (trail) {
          const movingDown = top > prev.top
          const trailTop = Math.min(prev.top, top)
          const trailBottom = Math.max(prev.top + prev.height, top + height)
          const trailHeight = trailBottom - trailTop

          trail.style.transition = 'none'
          trail.style.top = `${trailTop}px`
          trail.style.height = `${trailHeight}px`
          trail.style.opacity = '0.7'
          trail.style.background = movingDown
            ? 'linear-gradient(180deg, rgba(59,130,246,0) 0%, rgba(59,130,246,0.5) 40%, rgba(99,102,241,0.6) 100%)'
            : 'linear-gradient(0deg, rgba(59,130,246,0) 0%, rgba(59,130,246,0.5) 40%, rgba(99,102,241,0.6) 100%)'
          trail.offsetHeight // force reflow
          trail.style.transition = 'opacity 0.55s ease-out'
          trail.style.opacity = '0'
        }
      }

      _positionMemory.set(persistenceKey, { top, height })
      return true
    }

    const immediateSuccess = positionIndicator(alreadyMeasured)
    if (immediateSuccess) {
      _measuredKeys.add(persistenceKey)
    }

    const t1 = setTimeout(() => {
      if (positionIndicator(alreadyMeasured)) _measuredKeys.add(persistenceKey)
    }, 80)
    const t2 = setTimeout(() => {
      if (indicatorOpacity.get() < 0.5) {
        positionIndicator(false)
        _measuredKeys.add(persistenceKey)
      }
    }, 350)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, containerMounted, persistenceKey, activeDataAttr, indicatorTop, indicatorHeight, indicatorOpacity, ...deps])

  return {
    containerRefCb,
    trailRefCb,
    indicatorTop,
    indicatorHeight,
    indicatorOpacity,
  }
}
