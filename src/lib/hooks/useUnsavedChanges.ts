'use client'

import { useEffect, useRef } from 'react'

/**
 * Consolidates the `beforeunload` guard pattern.
 * When `isDirty` is true, prompts users before closing/refreshing the tab.
 * Optionally notifies a parent via `onDirtyChange` when the dirty state toggles.
 */
export function useUnsavedChanges(
  isDirty: boolean,
  onDirtyChange?: (dirty: boolean) => void,
): void {
  const prevDirty = useRef(isDirty)

  // Notify parent when dirty state changes
  useEffect(() => {
    if (prevDirty.current !== isDirty) {
      prevDirty.current = isDirty
      onDirtyChange?.(isDirty)
    }
  }, [isDirty, onDirtyChange])

  // Register/unregister beforeunload listener
  useEffect(() => {
    if (!isDirty) return

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])
}
