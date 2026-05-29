import type { MetadataRoute } from 'next'
import { HELP_ARTICLES } from '@/lib/help/articles'

const SITE_URL = 'https://lionheartapp.com'

/**
 * Top-level sitemap. Currently scoped to public marketing pages and the
 * help center. Add additional static routes (changelog, status, etc.) as
 * they ship.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/platform`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/solutions/events`, lastModified: now, changeFrequency: 'monthly', priority: 0.75 },
    { url: `${SITE_URL}/solutions/it`, lastModified: now, changeFrequency: 'monthly', priority: 0.75 },
    { url: `${SITE_URL}/solutions/maintenance`, lastModified: now, changeFrequency: 'monthly', priority: 0.75 },
    { url: `${SITE_URL}/solutions/forms-registration`, lastModified: now, changeFrequency: 'monthly', priority: 0.75 },
    { url: `${SITE_URL}/solutions/messaging`, lastModified: now, changeFrequency: 'monthly', priority: 0.75 },
    { url: `${SITE_URL}/leo-ai`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/security`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/help`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
  ]

  const helpRoutes: MetadataRoute.Sitemap = HELP_ARTICLES.map((article) => ({
    url: `${SITE_URL}/help/${article.slug}`,
    lastModified: new Date(article.updated),
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  return [...staticRoutes, ...helpRoutes]
}
