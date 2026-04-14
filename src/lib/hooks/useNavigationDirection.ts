'use client'

import { useRef, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

type Direction = 'push' | 'pop' | 'none'

/** Top-level tab routes — switching between these uses a crossfade, not a slide */
const TAB_ROUTES = new Set(['/dashboard', '/events', '/athletics', '/settings', '/maintenance', '/it', '/facilities'])

function isTabRoute(path: string): boolean {
  return TAB_ROUTES.has(path) || TAB_ROUTES.has('/' + path.split('/')[1])
}

/**
 * Tracks navigation direction by maintaining a shallow history stack.
 * Returns 'push' for forward navigation, 'pop' for back, 'none' for tab switches.
 */
export function useNavigationDirection(): Direction {
  const pathname = usePathname()
  const stackRef = useRef<string[]>([pathname])
  const [direction, setDirection] = useState<Direction>('none')

  useEffect(() => {
    const stack = stackRef.current
    const prev = stack[stack.length - 1]

    if (prev === pathname) return // same page, no direction

    // Tab-to-tab navigation: crossfade (no slide)
    if (isTabRoute(pathname) && isTabRoute(prev)) {
      stackRef.current = [pathname]
      setDirection('none')
      return
    }

    // If the new path matches the second-to-last in the stack, it's a "back"
    if (stack.length >= 2 && stack[stack.length - 2] === pathname) {
      stack.pop()
      setDirection('pop')
      return
    }

    // Otherwise it's a forward "push"
    stack.push(pathname)
    // Keep stack shallow (max 20 entries)
    if (stack.length > 20) stack.shift()
    setDirection('push')
  }, [pathname])

  return direction
}
