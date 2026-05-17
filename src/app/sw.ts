import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist, NetworkFirst, NetworkOnly, CacheFirst, StaleWhileRevalidate, ExpirationPlugin } from 'serwist'

declare global {
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}
declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    // Onboarding pages — NetworkOnly so the user always sees the latest
    // version of the signup funnel. Caching onboarding bit us when an
    // older deploy cached the plan picker and new users got served stale
    // HTML that bypassed Stripe Checkout entirely.
    {
      matcher: /^https?:\/\/[^/]+\/onboarding(\/.*)?$/,
      handler: new NetworkOnly(),
    },
    // Assigned tickets — NetworkFirst with 24h cache for offline access (OFFLINE-02)
    {
      matcher: /^https?:\/\/.*\/api\/maintenance\/tickets(\?.*)?$/,
      handler: new NetworkFirst({
        cacheName: 'maintenance-tickets-api',
        plugins: [{ cacheWillUpdate: async ({ response }: { response: Response }) => response.status === 200 ? response : null }],
        networkTimeoutSeconds: 5,
        matchOptions: { ignoreVary: true },
      }),
    },
    // Asset data — NetworkFirst with 7-day cache for offline QR scan support (OFFLINE-07)
    {
      matcher: /^https?:\/\/.*\/api\/maintenance\/assets(\?.*)?$/,
      handler: new NetworkFirst({
        cacheName: 'maintenance-assets-api',
        networkTimeoutSeconds: 5,
        matchOptions: { ignoreVary: true },
      }),
    },
    // Knowledge base — StaleWhileRevalidate (read-only, can be slightly stale)
    {
      matcher: /^https?:\/\/.*\/api\/maintenance\/knowledge-base(\?.*)?$/,
      handler: new StaleWhileRevalidate({
        cacheName: 'knowledge-base-api',
      }),
    },
    // Event check-in API — NetworkFirst with 5s timeout (day-of operations)
    {
      matcher: /^https?:\/\/.*\/api\/events\/projects\/[^/]+\/check-in/,
      handler: new NetworkFirst({
        cacheName: 'event-checkin-api',
        networkTimeoutSeconds: 5,
        matchOptions: { ignoreVary: true },
      }),
    },
    // Event incidents API — NetworkFirst with 5s timeout (day-of incident logging)
    {
      matcher: /^https?:\/\/.*\/api\/events\/projects\/[^/]+\/incidents/,
      handler: new NetworkFirst({
        cacheName: 'event-incidents-api',
        networkTimeoutSeconds: 5,
        matchOptions: { ignoreVary: true },
      }),
    },
    // Participant self-service QR endpoint — NetworkFirst with 5s timeout (QR-03)
    {
      matcher: /^https?:\/\/.*\/api\/events\/check-in\//,
      handler: new NetworkFirst({
        cacheName: 'event-participant-api',
        networkTimeoutSeconds: 5,
        matchOptions: { ignoreVary: true },
      }),
    },
    // All other API routes — NetworkFirst (no offline fallback, just try network)
    {
      matcher: /^https?:\/\/.*\/api\//,
      handler: new NetworkFirst({
        cacheName: 'api-cache',
        networkTimeoutSeconds: 10,
      }),
    },
    // Map tiles (OpenStreetMap, ArcGIS) — passthrough to network, skip SW caching
    {
      matcher: /(?:tile\.openstreetmap\.org|server\.arcgisonline\.com)/,
      handler: new NetworkOnly(),
    },
    // External media (GIPHY, etc.) — skip SW cache entirely.
    // GIPHY CDN URLs end in .gif and were being caught by the static
    // assets CacheFirst rule, causing stale/broken images on soft refresh.
    {
      matcher: /^https?:\/\/media[0-9]*\.giphy\.com\//,
      handler: new NetworkOnly(),
    },
    // Static assets (images, fonts, icons) — CacheFirst with 30-day expiry
    {
      matcher: /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf|otf)$/,
      handler: new CacheFirst({
        cacheName: 'static-assets',
        plugins: [new ExpirationPlugin({ maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },
    // Next.js static chunks — StaleWhileRevalidate so new deploys
    // always update cached bundles in the background. CacheFirst was
    // causing stale sidebar/page code to persist across deployments.
    {
      matcher: /\/_next\/static\//,
      handler: new StaleWhileRevalidate({
        cacheName: 'next-static',
        plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },
    // Pages — StaleWhileRevalidate (maintenance pages load fast from cache)
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher: ({ request }: { request: Request }) => request.destination === 'document',
      },
    ],
  },
})

// ─── Web Push Handler (NOTIF-03) ───────────────────────────────────────
// @ts-expect-error — SW global types incomplete in this tsconfig
self.addEventListener('push', (event: any) => {
  if (!event.data) return

  const data = event.data.json() as {
    title: string
    body: string
    url?: string
    icon?: string
    tag?: string
  }

  // Use tag from payload or derive from URL for smart grouping
  const tag = data.tag || (data.url?.includes('/messaging') ? 'messaging' : 'notification')

  const options: Record<string, unknown> = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    data: { url: data.url || '/' },
    tag,
    renotify: true,
  }

  event.waitUntil((self as any).registration.showNotification(data.title, options))
})

// @ts-expect-error — SW global types incomplete in this tsconfig
self.addEventListener('notificationclick', (event: any) => {
  event.notification.close()
  const url =
    (event.notification.data as { url?: string })?.url || '/'

  event.waitUntil(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (self as any).clients
      .matchAll({ type: 'window' })
      .then((windowClients: any[]) => {
        for (const client of windowClients) {
          if (client.url.includes(url) && 'focus' in client) {
            return client.focus()
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (self as any).clients.openWindow(url)
      })
  )
})

serwist.addEventListeners()
