'use client'

/**
 * TurnstileWidget — Cloudflare Turnstile CAPTCHA React wrapper.
 *
 * In production: renders the Turnstile iframe via the global Turnstile API
 * loaded by the layout's <Script> tag.
 *
 * In dev (no NEXT_PUBLIC_TURNSTILE_SITE_KEY): shows a placeholder and
 * immediately calls onSuccess with 'dev-token'.
 *
 * Exposes a reset() method via forwardRef + useImperativeHandle so the
 * parent can re-render the widget after a validation failure.
 */

import {
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string
          callback?: (token: string) => void
          'expired-callback'?: () => void
          'error-callback'?: () => void
          theme?: 'auto' | 'light' | 'dark'
        },
      ) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
  }
}

export interface TurnstileWidgetRef {
  reset: () => void
}

interface TurnstileWidgetProps {
  onSuccess: (token: string) => void
  onExpire?: () => void
  onError?: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

const TurnstileWidget = forwardRef<TurnstileWidgetRef, TurnstileWidgetProps>(
  function TurnstileWidget({ onSuccess, onExpire, onError }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const widgetIdRef = useRef<string | null>(null)
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

    const renderWidget = useCallback(() => {
      if (!containerRef.current || !window.turnstile || !siteKey) return
      // Clear any existing widget first
      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch {
          // Ignore — widget may already be gone
        }
        widgetIdRef.current = null
      }

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: onSuccess,
        'expired-callback': onExpire,
        'error-callback': onError,
        theme: 'auto',
      })
    }, [siteKey, onSuccess, onExpire, onError])

    // Expose reset() to parent
    useImperativeHandle(ref, () => ({
      reset() {
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current)
        }
      },
    }))

    useEffect(() => {
      if (!siteKey) {
        // Dev mode — skip CAPTCHA
        onSuccess('dev-token')
        return
      }

      // Turnstile script may not be loaded yet — poll for it
      let attempts = 0
      const MAX_ATTEMPTS = 40 // 10 seconds total

      const interval = setInterval(() => {
        attempts++
        if (window.turnstile) {
          clearInterval(interval)
          renderWidget()
        } else if (attempts >= MAX_ATTEMPTS) {
          clearInterval(interval)
          onError?.()
        }
      }, 250)

      return () => {
        clearInterval(interval)
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current)
          } catch {
            // Ignore
          }
        }
      }
    }, [siteKey, renderWidget, onSuccess, onError])

    // Dev mode placeholder
    if (!siteKey) {
      return (
        <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">
          <span className="font-mono text-yellow-500">⚠</span>
          CAPTCHA (dev mode — skipped)
        </div>
      )
    }

    return <div ref={containerRef} />
  },
)

TurnstileWidget.displayName = 'TurnstileWidget'

export default TurnstileWidget
