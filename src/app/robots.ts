import type { MetadataRoute } from 'next'

const SITE_URL = 'https://lionheartapp.com'

/**
 * Robots policy. Public marketing surface and help center are open to
 * crawlers; everything app-scoped (authenticated dashboards, tenant
 * subdomains, internal tools) is excluded.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/help'],
        disallow: [
          '/api/',
          '/app/',
          '/admin/',
          '/dashboard/',
          '/settings/',
          '/maintenance/',
          '/it/',
          '/onboarding/',
          '/events/portal',
          '/events/dashboard',
          '/events/check-in',
          '/events/[id]/dayof',
          '/set-password',
          '/reset-password',
          '/verify-email',
          '/r/',
          '/f/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
