'use client'

import { useEffect, useState } from 'react'

/**
 * Returns true when the viewport is at or above the Tailwind `md` breakpoint
 * (≥768px). Used to force list view on mobile for the events kanban board.
 *
 * Hydration note: returns `false` on first render (SSR + pre-hydration) to
 * avoid a flash of the desktop layout on mobile devices.
 */
export function useIsDesktop(breakpoint = 768): boolean {
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(`(min-width: ${breakpoint}px)`)
    const update = () => setIsDesktop(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [breakpoint])

  return isDesktop
}
