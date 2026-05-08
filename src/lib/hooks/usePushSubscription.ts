'use client'

/**
 * usePushSubscription — manages browser push notification subscription (D-09).
 *
 * Checks browser support, current subscription status, and provides
 * subscribe/unsubscribe functions that sync with the server.
 */

import { useState, useEffect, useCallback } from 'react'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a base64-encoded VAPID public key to a Uint8Array
 * for use with pushManager.subscribe().
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UsePushSubscriptionResult {
  isSupported: boolean
  isSubscribed: boolean
  isLoading: boolean
  subscribe: () => Promise<void>
  unsubscribe: () => Promise<void>
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePushSubscription(): UsePushSubscriptionResult {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Check support and existing subscription on mount
  useEffect(() => {
    const checkSubscription = async () => {
      const supported =
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window

      setIsSupported(supported)

      if (!supported) {
        setIsLoading(false)
        return
      }

      try {
        const registration = await navigator.serviceWorker.ready
        const existing = await registration.pushManager.getSubscription()
        setIsSubscribed(!!existing)
      } catch {
        // Silently handle — push not available
      } finally {
        setIsLoading(false)
      }
    }

    checkSubscription()
  }, [])

  const subscribe = useCallback(async () => {
    if (!isSupported) return

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) {
      console.warn('NEXT_PUBLIC_VAPID_PUBLIC_KEY not configured — push subscription skipped')
      return
    }

    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      })

      const json = subscription.toJSON()
      const keys = json.keys as { p256dh: string; auth: string } | undefined

      if (!json.endpoint || !keys) {
        throw new Error('Invalid push subscription — missing endpoint or keys')
      }

      // Register with server
      await fetch('/api/messaging/push-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: keys.p256dh, auth: keys.auth },
        }),
      })

      setIsSubscribed(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.warn('Push subscription failed:', msg)
    }
  }, [isSupported])

  const unsubscribe = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        const endpoint = subscription.endpoint
        await subscription.unsubscribe()

        // Remove from server
        await fetch('/api/messaging/push-subscription', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ endpoint }),
        })
      }

      setIsSubscribed(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.warn('Push unsubscribe failed:', msg)
    }
  }, [])

  return { isSupported, isSubscribed, isLoading, subscribe, unsubscribe }
}
