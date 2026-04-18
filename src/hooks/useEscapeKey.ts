'use client'

import { useEffect } from 'react'

/**
 * Subscribe to global Escape keypresses while `enabled` is true.
 *
 * Designed for dropdowns, popovers, and dialogs that need to close on Escape
 * without each component reimplementing the listener (and remembering to
 * remove it on unmount).
 *
 * Audit ref M2: dashboard + inventory dropdowns close on outside-click but
 * not on Escape, trapping keyboard users.
 *
 * @example
 *   const [open, setOpen] = useState(false)
 *   useEscapeKey(open, () => setOpen(false))
 */
export function useEscapeKey(enabled: boolean, onEscape: () => void): void {
  useEffect(() => {
    if (!enabled) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Stop the event from bubbling to higher-level handlers (e.g. a parent
        // dialog) so the innermost dismissable layer wins.
        event.stopPropagation()
        onEscape()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [enabled, onEscape])
}
