/**
 * Tenant/Organization config for SaaS.
 * Today: reads from env. Future: resolve from session/JWT org context.
 */

export type OrgConfig = {
  name: string
  website: string
  slug: string
}

export function getOrgConfig(): OrgConfig {
  return {
    name: process.env.ORG_NAME?.trim() || process.env.NEXT_PUBLIC_ORG_NAME?.trim() || process.env.VITE_ORG_NAME?.trim() || '',
    website: process.env.ORG_WEBSITE?.trim() || process.env.NEXT_PUBLIC_ORG_WEBSITE?.trim() || process.env.VITE_ORG_WEBSITE?.trim() || '',
    slug: process.env.ORG_SLUG?.trim() || 'default',
  }
}
