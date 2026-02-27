/**
 * Organization Service
 * 
 * Handles organization-level operations, including public branding data
 * for subdomain customization (logos, hero images, layout preferences).
 * 
 * Note: Uses raw PrismaClient to bypass org-scoping for public lookups.
 */

import { ImagePosition, SchoolType, InstitutionType } from '@prisma/client';
import { rawPrisma } from '@/lib/db';

export interface OrganizationBranding {
  id: string;
  name: string;
  institutionType: InstitutionType;
  gradeLevel: SchoolType;
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
  try {
    const org = await rawPrisma.organization.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        institutionType: true,
        gradeLevel: true,
        slug: true,
        logoUrl: true,
        heroImageUrl: true,
        imagePosition: true,
      },
    });

    return org;
  } catch (error) {
    console.error('Error fetching organization branding:', error);
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
