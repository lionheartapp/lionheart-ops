'use client'

import { useEffect } from 'react'

const BASE_TITLE = 'Lionheart'

/**
 * Sets the document title for client-rendered pages.
 * Restores the base title on unmount.
 */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} | ${BASE_TITLE}`
    return () => {
      document.title = BASE_TITLE
    }
  }, [title])
}
