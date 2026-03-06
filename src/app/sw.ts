import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist, NetworkFirst, CacheFirst, StaleWhileRevalidate, ExpirationPlugin } from 'serwist'

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
  navigationPreload: true,
  runtimeCaching: [
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
    // All other API routes — NetworkFirst (no offline fallback, just try network)
    {
      matcher: /^https?:\/\/.*\/api\//,
      handler: new NetworkFirst({
        cacheName: 'api-cache',
        networkTimeoutSeconds: 10,
      }),
    },
    // Static assets (images, fonts, icons) — CacheFirst with 30-day expiry
    {
      matcher: /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf|otf)$/,
      handler: new CacheFirst({
        cacheName: 'static-assets',
        plugins: [new ExpirationPlugin({ maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },
    // Next.js static chunks — CacheFirst (immutable hashed filenames)
    {
      matcher: /\/_next\/static\//,
      handler: new CacheFirst({
        cacheName: 'next-static',
        plugins: [new ExpirationPlugin({ maxAgeSeconds: 365 * 24 * 60 * 60 })],
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

serwist.addEventListeners()
