import { prisma } from '@/lib/db';
export async function getFacilitiesForTenant(tenantSlug: string) {
  // Find tenant organization
  const org = await prisma.organization.findUnique({
    where: { slug: tenantSlug.toLowerCase() },
    select: { id: true },
  });
  if (!org) return [];

  // Fetch rooms scoped by tenant (as facilities)
  const rooms = await prisma.room.findMany({
    where: { organizationId: org.id },
    orderBy: { displayName: 'asc' },
    select: {
      id: true,
      displayName: true,
      roomNumber: true,
      floor: true,
    },
  });
  return rooms;
}
