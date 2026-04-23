/**
 * Organization Service
 * 
 * Handles organization-level operations, including public branding data
 * for subdomain customization (logos, hero images, layout preferences).
 * 
 * Note: Uses raw PrismaClient to bypass org-scoping for public lookups.
 */

import { ImagePosition } from '@prisma/client';
import { rawPrisma } from '@/lib/db';
import { logger } from '@/lib/logger'


const log = logger.child({ service: 'organizationService' })

/**
 * Public-facing branding info used on the login page before authentication.
 *
 * NEW ONTOLOGY (Phase 1b): Organizations no longer carry `institutionType` or
 * `gradeLevel` directly — those fields moved to the `School` model. For the
 * pre-auth branding endpoint we fall back to the org's primary school when we
 * need to surface those fields (see getOrganizationBranding below).
 */
export interface OrganizationBranding {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  heroImageUrl: string | null;
  imagePosition: ImagePosition;
}

/**
 * Get public branding information for an organization by subdomain slug
 * This is used on the login page before authentication to customize the UI
 * 
 * @param slug - The subdomain slug (e.g., "demo" from demo.lionheartapp.com)
 * @returns Organization branding data or null if not found
 */
export async function getOrganizationBranding(
  slug: string
): Promise<OrganizationBranding | null> {
  const select = {
    id: true,
    name: true,
    slug: true,
    logoUrl: true,
    heroImageUrl: true,
    imagePosition: true,
  } as const;

  try {
    // Try exact slug match first (e.g., "linfield-christian-school")
    const org = await rawPrisma.organization.findUnique({
      where: { slug },
      select,
    });

    if (org) return org;

    // If no match, try fuzzy match: strip hyphens from both sides
    // This lets "linfieldchristianschool" match "linfield-christian-school"
    const normalizedInput = slug.replace(/-/g, '').toLowerCase();
    const fuzzyResults = await rawPrisma.$queryRaw<Array<{ slug: string }>>`
      SELECT slug FROM "Organization"
      WHERE REPLACE(LOWER(slug), '-', '') = ${normalizedInput}
      LIMIT 1
    `;

    if (fuzzyResults.length > 0) {
      return await rawPrisma.organization.findUnique({
        where: { slug: fuzzyResults[0].slug },
        select,
      });
    }

    return null;
  } catch (error) {
    log.error({ err: String(error) }, 'Error fetching organization branding');
    return null;
  }
}

/**
 * Update organization branding settings
 * Requires admin permissions (enforced at API route level)
 * 
 * @param organizationId - The organization to update
 * @param branding - Branding fields to update
 */
export async function updateOrganizationBranding(
  organizationId: string,
  branding: {
    logoUrl?: string;
    heroImageUrl?: string;
    imagePosition?: ImagePosition;
  }
) {
  return await rawPrisma.organization.update({
    where: { id: organizationId },
    data: branding,
  });
}
