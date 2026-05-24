import type { NextConfig } from 'next'
import withSerwistInit from '@serwist/next'
import { withSentryConfig } from '@sentry/nextjs'

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
})

const nextConfig: NextConfig = {
  eslint: {
    // F-020 (partial): the directives that referenced uninstalled
    // @typescript-eslint rules + the obvious `module` shadowing in API
    // routes are fixed. ~20 lint errors remain (mostly hooks-of-rules
    // violations that need careful per-component investigation, plus a
    // handful of unescaped JSX entities). See LINT_DEBT.md for the list.
    // Once those are resolved this should flip to false and lint becomes
    // a real CI gate.
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: ['mjml', 'mjml-core', 'mjml-preset-core', 'pino', 'pino-pretty'],
  turbopack: {
    root: process.cwd(),
  },
  poweredByHeader: false,
  devIndicators: false,
  compress: true,
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async redirects() {
    return [
      // Browsers auto-request /favicon.ico regardless of <link rel="icon">.
      // Redirect to the SVG favicon to prevent a 404 console error.
      {
        source: '/favicon.ico',
        destination: '/favicon.svg',
        permanent: true,
      },
    ]
  },
  async headers() {
    const contentSecurityPolicy = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://challenges.cloudflare.com https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://unpkg.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.stripe.com https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com https://maps.googleapis.com https://unpkg.com https://*.tile.openstreetmap.org https://server.arcgisonline.com https://images.unsplash.com https://media.giphy.com https://media0.giphy.com https://media1.giphy.com https://media2.giphy.com https://media3.giphy.com https://media4.giphy.com",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com",
      "worker-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ')

    const securityHeaders = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Content-Security-Policy', value: contentSecurityPolicy },
    ]

    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: process.env.NEXT_PUBLIC_APP_URL || '' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, x-org-id' },
          { key: 'Access-Control-Expose-Headers', value: 'Authorization' },
        ],
      },
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

const isDev = process.env.NODE_ENV === 'development'

// Skip Sentry wrapping in dev — saves significant compile time
export default isDev
  ? withSerwist(nextConfig)
  : withSentryConfig(withSerwist(nextConfig), {
      silent: true,
      sourcemaps: {
        disable: !process.env.SENTRY_AUTH_TOKEN,
      },
    })
