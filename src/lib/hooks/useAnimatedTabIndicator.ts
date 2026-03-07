'use client'

import { useRef, useLayoutEffect } from 'react'
import { useMotionValue, animate as fmAnimate } from 'framer-motion'

/**
 * Hook that powers an animated underline indicator for tab navigation.
 * Returns refs for the container and tab elements, plus motion values for the indicator.
 *
 * Usage:
 * ```tsx
 * const { containerRef, setTabRef, indicatorStyle } = useAnimatedTabIndicator(activeTab)
 *
 * <div ref={containerRef} className="relative flex ...">
 *   <button ref={(el) => setTabRef('key', el)} ...>Tab</button>
 *   <TabIndicator style={indicatorStyle} />
 * </div>
 * ```
 */
export function useAnimatedTabIndicator(activeKey: string, deps: unknown[] = []) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Map<string, HTMLElement>>(new Map())
  const indicatorLeft = useMotionValue(0)
  const indicatorWidth = useMotionValue(0)
  const indicatorOpacity = useMotionValue(0)
  const hasAnimated = useRef(false)

  const setTabRef = (key: string, el: HTMLElement | null) => {
    if (el) tabRefs.current.set(key, el)
  }

  useLayoutEffect(() => {
    const measure = () => {
      const container = containerRef.current
      const activeEl = tabRefs.current.get(activeKey)
      if (!container || !activeEl) return false

      const containerRect = container.getBoundingClientRect()
      const elRect = activeEl.getBoundingClientRect()
      const left = elRect.left - containerRect.left
      const width = elRect.width

      // Element not laid out yet — retry later
      if (width < 1) return false

      const easing = [0.22, 1, 0.36, 1] as [number, number, number, number]

      if (!hasAnimated.current) {
        // First render — snap into place
        indicatorLeft.jump(left)
        indicatorWidth.jump(width)
        indicatorOpacity.jump(1)
        hasAnimated.current = true
      } else {
        // Animate to new position
        fmAnimate(indicatorLeft, left, { duration: 0.35, ease: easing })
        fmAnimate(indicatorWidth, width, { duration: 0.35, ease: easing })
      }
      return true
    }

    if (measure()) return

    // Fallback: element may not be laid out yet (async data, CSS transitions)
    const t1 = setTimeout(measure, 50)
    const t2 = setTimeout(measure, 150)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [activeKey, ...deps]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    containerRef,
    setTabRef,
    indicatorStyle: {
      left: indicatorLeft,
      width: indicatorWidth,
      opacity: indicatorOpacity,
      background: 'linear-gradient(90deg, #3B82F6 0%, #6366F1 100%)',
      boxShadow: '0 0 8px rgba(59, 130, 246, 0.4), 0 0 16px rgba(99, 102, 241, 0.2)',
    },
  }
}
