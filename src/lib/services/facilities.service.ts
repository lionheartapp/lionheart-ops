import { prisma } from '@/lib/db';

export async function getFacilitiesForTenant(tenantSlug: string) {
  // Find tenant organization
  const org = await prisma.organization.findUnique({
    where: { slug: tenantSlug.toLowerCase() },
    select: { id: true },
  });
  if (!org) return [];

  // Fetch facilities scoped by tenant
  const facilities = await prisma.facility.findMany({
    where: { organizationId: org.id },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      location: true,
    },
  });
  return facilities;
}
