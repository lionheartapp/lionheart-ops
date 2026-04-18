import { headers } from 'next/headers'

export type Viewport = 'mobile' | 'tablet' | 'desktop'

/**
 * Read the viewport injected by `middleware.ts` into the `x-viewport` header.
 *
 * Audit ref M4: server components should call this instead of branching on
 * `window.innerWidth` after hydration, which causes a layout shift. UA-based
 * detection isn't 100% accurate — pair it with `useViewport()` (client) for
 * resize-aware refinements.
 */
export async function getViewport(): Promise<Viewport> {
  const h = await headers()
  const value = h.get('x-viewport')
  if (value === 'mobile' || value === 'tablet') return value
  return 'desktop'
}

/** Whether the request was identified as a mobile or tablet device. */
export async function getIsTouch(): Promise<boolean> {
  const v = await getViewport()
  return v === 'mobile' || v === 'tablet'
}
