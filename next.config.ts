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
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: ['mjml', 'mjml-core', 'mjml-preset-core', 'pino-pretty'],
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, x-org-id' },
          { key: 'Access-Control-Expose-Headers', value: 'Authorization' },
        ],
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
