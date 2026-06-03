/**
 * Knowledge base / help center type definitions.
 *
 * Articles are authored as typed TypeScript objects (rather than MDX) so we
 * stay zero-dependency, get full type safety on every block, and can easily
 * derive search indices, sitemaps, and structured-data payloads at build time.
 */

export type HelpAudience =
  | 'end-user' // Teachers, staff, anyone who uses the app day-to-day
  | 'org-admin' // Super-admins / admins setting the org up
  | 'it-facilities' // IT and facilities team members working tickets
  | 'all'

export type HelpCategorySlug =
  | 'getting-started'
  | 'tickets'
  | 'events'
  | 'campus'
  | 'inventory'
  | 'admin'
  | 'leo-ai'

export interface HelpCategory {
  slug: HelpCategorySlug
  title: string
  description: string
  /** Lucide icon name — looked up at render time. */
  icon:
    | 'BookOpen'
    | 'Wrench'
    | 'Calendar'
    | 'Building2'
    | 'Boxes'
    | 'ShieldCheck'
    | 'Sparkles'
}

/* ─── Content blocks ────────────────────────────────────────────────────── */

export type HelpBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level: 2 | 3; text: string; id?: string }
  | {
      type: 'image'
      src: string
      alt: string
      caption?: string
      width?: number
      height?: number
      priority?: boolean
    }
  | { type: 'list'; ordered?: boolean; items: string[] }
  | { type: 'steps'; items: { title: string; body: string }[] }
  | { type: 'callout'; tone: 'info' | 'warn' | 'tip'; title?: string; body: string }
  | { type: 'code'; language?: string; code: string }
  | { type: 'divider' }

/* ─── Article shape ─────────────────────────────────────────────────────── */

export interface HelpArticle {
  /** URL slug — must be globally unique within /help. */
  slug: string
  title: string
  /** One-line summary used in cards, search results, and meta descriptions. */
  description: string
  category: HelpCategorySlug
  audience: HelpAudience[]
  /** ISO date string (YYYY-MM-DD) of last edit — drives the SEO `dateModified`. */
  updated: string
  /** Estimated read time in minutes — shown next to the title. */
  readMinutes: number
  /** Free-text keywords that boost the client-side search beyond title/description. */
  keywords?: string[]
  /** Ordered content blocks. */
  body: HelpBlock[]
  /** Slugs of related articles. Optional — defaults to same-category neighbours. */
  related?: string[]
}
