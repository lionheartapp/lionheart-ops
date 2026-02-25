import { prisma } from '@/lib/db';

export async function getTenantConfig(tenantSlug: string) {
  // Fetch tenant config from organization table
  const org = await prisma.organization.findUnique({
    where: { slug: tenantSlug.toLowerCase() },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      theme: true,
      featureFlags: true,
    },
  });
  if (!org) return null;
  return org;
}
